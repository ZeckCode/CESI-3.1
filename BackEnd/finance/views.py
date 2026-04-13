# finance/views.py
from decimal import Decimal
from datetime import date

from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Sum
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from reminders.views import create_reminder_once
from reminders.models import Reminder
from accounts.models import User, UserProfile
from .models import AdvanceRequest, Transaction, TuitionConfig, ProofOfPayment
from .utils import (
    normalize_money,
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)
from .serializers import (
    TransactionSerializer,
    TransactionCreateSerializer,
    ParentDropdownSerializer,
    TuitionConfigSerializer,
    TuitionConfigCreateSerializer,
    ProofOfPaymentSerializer,
    AdvanceRequestSerializer,
)


from django.db import transaction as db_transaction
from django.utils import timezone
from enrollment.models import Enrollment


# 
#  helper functions for views, not actual views themselves
# 


def get_active_enrollment_by_student_number(student_number):
    return Enrollment.objects.filter(
        student_number=student_number,
        status='ACTIVE'
    ).select_related('parent_user', 'student').order_by('-created_at').first()


def ledger_totals_for_enrollment(enrollment):
    totals = Transaction.objects.filter(enrollment=enrollment).aggregate(
        total_debit=Sum('debit'),
        total_credit=Sum('credit'),
    )
    total_debit = Decimal(str(totals.get('total_debit') or 0))
    total_credit = Decimal(str(totals.get('total_credit') or 0))
    balance = total_debit - total_credit
    return total_debit, total_credit, balance


def compute_simple_ledger_status(balance):
    if balance <= 0:
        return 'PAID'
    return 'PARTIAL'

def get_available_advance_for_enrollment(enrollment):
    advance_total = Transaction.objects.filter(
        enrollment=enrollment,
        entry_type='CREDIT',
        item='ADVANCE'
    ).aggregate(total=Sum('credit')).get('total') or Decimal('0.00')

    transferred_total = Transaction.objects.filter(
        enrollment=enrollment,
        entry_type='DEBIT',
        item__in=['REFUND', 'ADVANCE_TRANSFER_OUT']
    ).aggregate(total=Sum('debit')).get('total') or Decimal('0.00')

    available = Decimal(str(advance_total)) - Decimal(str(transferred_total))
    return available if available > 0 else Decimal('0.00')


def ledger_totals_and_advance_for_parent(parent):
    totals = Transaction.objects.filter(parent=parent).aggregate(
        total_debit=Sum('debit'),
        total_credit=Sum('credit'),
    )
    total_debit = Decimal(str(totals.get('total_debit') or 0))
    total_credit = Decimal(str(totals.get('total_credit') or 0))
    raw_balance = total_debit - total_credit

    payable_balance = raw_balance if raw_balance > 0 else Decimal('0.00')
    advance_available = abs(raw_balance) if raw_balance < 0 else Decimal('0.00')

    return total_debit, total_credit, payable_balance, advance_available


def send_payment_received_reminder(*, sender, payment_tx):
    recipient = payment_tx.parent
    if not recipient:
        return

    remaining_balance = Decimal("0.00")
    if payment_tx.enrollment:
        _, _, remaining_balance = ledger_totals_for_enrollment(payment_tx.enrollment)
        if remaining_balance < 0:
            remaining_balance = Decimal("0.00")

    title = "Payment Received"
    message = (
        f"Good news! We have received your payment for {payment_tx.student_name}.\n"
        f"Reference No: {payment_tx.reference_number}\n"
        f"Amount Paid: ₱{Decimal(str(payment_tx.credit or payment_tx.amount or 0))}\n"
        f"Remaining Balance: ₱{remaining_balance}\n"
        f"Thank you for your payment."
    ).strip()

    create_reminder_once(
        recipient=recipient,
        sender=sender,
        title=title,
        message=message,
        reminder_type="PAYMENT",
        event_type="PAYMENT_RECEIVED",
        transaction=payment_tx,
        reference_date=payment_tx.transaction_date or timezone.localdate(),
    )


def auto_apply_previous_advance_to_enrollment(target_enrollment):
    from enrollment.models import Enrollment

    student_number = (target_enrollment.student_number or '').strip()
    if not student_number:
        return Decimal('0.00')

    previous_enrollments = Enrollment.objects.filter(
        student_number=student_number
    ).exclude(id=target_enrollment.id).order_by('-created_at')

    total_applied = Decimal('0.00')

    target_debit, target_credit, target_balance = ledger_totals_for_enrollment(target_enrollment)
    remaining_needed = target_balance if target_balance > 0 else Decimal('0.00')

    if remaining_needed <= 0:
        return Decimal('0.00')

    target_student_name = (
        f"{target_enrollment.first_name or ''} {target_enrollment.last_name or ''}".strip()
        or target_enrollment.student.username
    )

    for source_enrollment in previous_enrollments:
        if remaining_needed <= 0:
            break

        available = get_available_advance_for_enrollment(source_enrollment)
        if available <= 0:
            continue

        to_apply = available if available <= remaining_needed else remaining_needed

        source_student_name = (
            f"{source_enrollment.first_name or ''} {source_enrollment.last_name or ''}".strip()
            or source_enrollment.student.username
        )

        Transaction.objects.create(
            parent=source_enrollment.parent_user,
            enrollment=source_enrollment,
            student_name=source_student_name,
            transaction_type='TUITION',
            entry_type='DEBIT',
            item='ADVANCE_TRANSFER_OUT',
            school_year=source_enrollment.academic_year,
            semester='1st',
            amount=to_apply,
            description=f'Advance credit transferred to Enrollment #{target_enrollment.id}.',
            payment_method='OTHER',
            transaction_date=timezone.localdate(),
            status='POSTED',
            student_number_snapshot=source_enrollment.student_number,
            grade_level_snapshot=source_enrollment.grade_level,
            payment_mode_snapshot=source_enrollment.payment_mode,
            student_type_snapshot=source_enrollment.student_type,
            reference_number=generate_transaction_reference(),
        )

        Transaction.objects.create(
            parent=target_enrollment.parent_user,
            enrollment=target_enrollment,
            student_name=target_student_name,
            transaction_type='TUITION',
            entry_type='CREDIT',
            item='ADVANCE_APPLIED',
            school_year=target_enrollment.academic_year,
            semester='1st',
            amount=to_apply,
            description=f'Advance credit auto-applied from Enrollment #{source_enrollment.id}.',
            payment_method='OTHER',
            transaction_date=timezone.localdate(),
            status='PAID' if to_apply == remaining_needed else 'PARTIAL',
            student_number_snapshot=target_enrollment.student_number,
            grade_level_snapshot=target_enrollment.grade_level,
            payment_mode_snapshot=target_enrollment.payment_mode,
            student_type_snapshot=target_enrollment.student_type,
            reference_number=generate_transaction_reference(),
        )

        recompute_running_balances_for_enrollment(source_enrollment)
        recompute_transaction_statuses_for_enrollment(source_enrollment)
        recompute_running_balances_for_enrollment(target_enrollment)
        recompute_transaction_statuses_for_enrollment(target_enrollment)

        total_applied += to_apply
        remaining_needed -= to_apply

    return total_applied

def generate_transaction_reference():
    year = timezone.now().year
    last = Transaction.objects.order_by('-id').first()
    seq = (last.id + 1) if last else 1
    return f"CESI-{year}-{seq:05d}"


def build_installment_schedule(tuition):
    items = []

    installment = Decimal(str(tuition.installment or 0))
    initial = Decimal(str(tuition.initial or 0))
    monthly = Decimal(str(tuition.monthly or 0))
    misc_aug = Decimal(str(tuition.misc_aug or 0))
    misc_nov = Decimal(str(tuition.misc_nov or 0))

    # Calculate year from current date for dynamic scheduling
    current_year = timezone.now().year
    
    initial_due = date(current_year, 5, 31)
    if initial > 0:
        items.append({
            'type': 'Initial Payment',
            'item': 'INITIAL',
            'month': 'May',
            'amount': initial,
            'due_date': initial_due,
        })

    months = [
        ('June', date(current_year, 6, 30)),
        ('July', date(current_year, 7, 31)),
        ('August', date(current_year, 8, 31)),
        ('September', date(current_year, 9, 30)),
        ('October', date(current_year, 10, 31)),
        ('November', date(current_year, 11, 30)),
        ('December', date(current_year, 12, 31)),
        ('January', date(current_year + 1, 1, 31)),
        ('February', date(current_year + 1, 2, 28)),
        ('March', date(current_year + 1, 3, 31)),
    ]

    if monthly > 0:
        for label, due in months:
            items.append({
                'type': f'{label} Installment',
                'item': 'MONTHLY',
                'month': label,
                'amount': monthly,
                'due_date': due,
            })

    scheduled_installment = initial + (monthly * Decimal('10'))
    installment_adjustment = installment - scheduled_installment
    if installment_adjustment != 0:
        # Keep schedule totals aligned with configured installment even when
        # reference grade breakdown does not strictly match initial + 10 monthly.
        items.append({
            'type': 'Installment Adjustment',
            'item': 'ADJUSTMENT',
            'month': 'March',
            'amount': installment_adjustment,
            'due_date': date(current_year + 1, 3, 31),
        })

    if misc_aug > 0:
        items.append({
            'type': 'Miscellaneous (August)',
            'item': 'MISC',
            'month': 'August',
            'amount': misc_aug,
            'due_date': date(current_year, 8, 31),
        })

    if misc_nov > 0:
        items.append({
            'type': 'Miscellaneous (November)',
            'item': 'MISC',
            'month': 'November',
            'amount': misc_nov,
            'due_date': date(current_year, 11, 30),
        })

    return items


def ledger_totals_for_parent(parent):
    totals = Transaction.objects.filter(parent=parent).aggregate(
        total_debit=Sum('debit'),
        total_credit=Sum('credit'),
    )
    total_debit = Decimal(str(totals.get('total_debit') or 0))
    total_credit = Decimal(str(totals.get('total_credit') or 0))
    balance = total_debit - total_credit
    if balance < 0:
        balance = Decimal('0.00')
    return total_debit, total_credit, balance


def tuition_paid_for_parent(parent):
    totals = Transaction.objects.filter(
        parent=parent,
        transaction_type='TUITION'
    ).aggregate(total_credit=Sum('credit'))
    return Decimal(str(totals.get('total_credit') or 0))


def compute_cash_status(total_due, total_paid):
    if total_due > 0 and total_paid >= total_due:
        return 'PAID'
    return 'PENDING'


def compute_installment_status(total_due, total_paid, tuition):
    today = date.today()

    if total_due > 0 and total_paid >= total_due:
        return 'PAID'

    schedule = build_installment_schedule(tuition)

    if total_paid <= 0:
        has_overdue = any(item['due_date'] < today for item in schedule if item['item'] != 'INITIAL')
        return 'OVERDUE' if has_overdue else 'PENDING'

    covered = Decimal('0.00')
    for item in schedule:
        next_covered = covered + item['amount']
        if next_covered > total_paid:
            if item['due_date'] < today:
                return 'OVERDUE'
            return 'PARTIAL'
        covered = next_covered

    return 'PARTIAL'


class TransactionListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Transaction.objects.select_related('parent', 'parent__profile').all()
        search = self.request.query_params.get('search', '').strip()
        status_filter = self.request.query_params.get('status', '').strip().upper()
        entry_type = self.request.query_params.get('entry_type', '').strip().upper()
        school_year = self.request.query_params.get('school_year', '').strip()
        enrollment_id = self.request.query_params.get('enrollment_id', '').strip()
        
        if search:
            qs = qs.filter(
                Q(student_name__icontains=search)
                | Q(reference_number__icontains=search)
                | Q(parent__profile__student_first_name__icontains=search)
                | Q(parent__profile__student_last_name__icontains=search)
                | Q(parent__profile__student_number__icontains=search)
                | Q(item__icontains=search)
            ).distinct()
            
        if enrollment_id:
            qs = qs.filter(enrollment_id=enrollment_id)

        if status_filter and status_filter in ['PAID', 'PARTIAL', 'PENDING', 'OVERDUE', 'POSTED']:
            qs = qs.filter(status=status_filter)

        if entry_type and entry_type in ['DEBIT', 'CREDIT']:
            qs = qs.filter(entry_type=entry_type)

        if school_year:
            qs = qs.filter(school_year=school_year)

        return qs.order_by('transaction_date', 'date_posted', 'id')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TransactionCreateSerializer
        return TransactionSerializer

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transaction = serializer.save()
        out = TransactionSerializer(transaction).data
        return Response(out, status=status.HTTP_201_CREATED)


class TransactionDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Transaction.objects.select_related('parent').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return TransactionCreateSerializer
        return TransactionSerializer

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        out = TransactionSerializer(instance).data
        return Response(out)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_stats(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    totals = Transaction.objects.aggregate(
        total_debit=Sum('debit'),
        total_credit=Sum('credit'),
    )
    total_debit = Decimal(str(totals.get('total_debit') or 0))
    total_credit = Decimal(str(totals.get('total_credit') or 0))
    balance = total_debit - total_credit
    if balance < 0:
        balance = Decimal('0.00')

    return Response({
        'total_billed': float(total_debit),
        'total_collected': float(total_credit),
        'outstanding_balance': float(balance),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parent_list(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    search = request.query_params.get('search', '')
    qs = User.objects.filter(role='PARENT_STUDENT')

    if search:
        qs = qs.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(profile__student_first_name__icontains=search)
            | Q(profile__student_last_name__icontains=search)
            | Q(profile__parent_first_name__icontains=search)
            | Q(profile__parent_last_name__icontains=search)
            | Q(profile__student_number__icontains=search)
        )

    qs = qs.select_related('profile')
    serializer = ParentDropdownSerializer(qs.distinct()[:50], many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parent_students(request, parent_id):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    try:
        parent = User.objects.get(pk=parent_id, role='PARENT_STUDENT')
    except User.DoesNotExist:
        return Response({'detail': 'Parent not found'}, status=404)

    profiles = UserProfile.objects.filter(user=parent).select_related('section')
    students = []

    for p in profiles:
        students.append({
            'student_name': f"{p.student_first_name} {p.student_middle_name or ''} {p.student_last_name}".replace('  ', ' ').strip(),
            'grade_level': p.grade_level,
            'section': str(p.section) if p.section else '—',
            'parent_name': f"{p.parent_first_name} {p.parent_last_name}",
            'contact_number': p.contact_number,
            'student_number': p.student_number or '',
            'payment_mode': p.payment_mode or '',
        })

    return Response(students)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_transactions(request):
    if getattr(request.user, 'role', None) != 'PARENT_STUDENT':
        return Response({'detail': 'Forbidden'}, status=403)

    qs = Transaction.objects.filter(parent=request.user).order_by('transaction_date', 'date_posted', 'id')
    serializer = TransactionSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_ledger_summary(request):
    if getattr(request.user, 'role', None) != 'PARENT_STUDENT':
        return Response({'detail': 'Forbidden'}, status=403)

    total_billed, total_paid, balance, advance_available = ledger_totals_and_advance_for_parent(request.user)

    return Response({
        'total_billed': float(total_billed),
        'total_paid': float(total_paid),
        'balance': float(balance),
        'advance_available': float(advance_available),
    })

class TuitionConfigListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TuitionConfig.objects.all()
        search = self.request.query_params.get('search', '')
        status_filter = self.request.query_params.get('status', '')
        grade_key = self.request.query_params.get('grade_key', '')

        if search:
            qs = qs.filter(
                Q(grade_key__icontains=search)
                | Q(grade_label__icontains=search)
                | Q(description__icontains=search)
            )

        if status_filter:
            qs = qs.filter(status=status_filter.lower())

        if grade_key:
            qs = qs.filter(grade_key=grade_key)

        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TuitionConfigCreateSerializer
        return TuitionConfigSerializer

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return Response(TuitionConfigSerializer(obj).data, status=status.HTTP_201_CREATED)


class TuitionConfigDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = TuitionConfig.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return TuitionConfigCreateSerializer
        return TuitionConfigSerializer

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return Response(TuitionConfigSerializer(obj).data)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tuition_config_stats(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    qs = TuitionConfig.objects.all()
    total_configs = qs.count()
    active_configs = qs.filter(status='active').count()
    avg_total_cash = 0

    if total_configs > 0:
        avg_total_cash = sum([float(x.total_cash) for x in qs]) / total_configs

    return Response({
        'total_configs': total_configs,
        'active_configs': active_configs,
        'avg_total_cash': round(avg_total_cash, 2),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def tuition_config_by_grade(request, grade_key):
    qs = TuitionConfig.objects.filter(
        grade_key=grade_key,
        is_active=True,
        status='active',
    )
    obj = qs.first()

    if not obj:
        return Response({'detail': 'Tuition config not found'}, status=404)

    return Response(TuitionConfigSerializer(obj).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_tuition_overview(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    search = request.query_params.get('search', '').strip()
    grade_level = request.query_params.get('grade_level', '').strip()

    qs = UserProfile.objects.select_related('user', 'section').all()

    if search:
        qs = qs.filter(
            Q(student_first_name__icontains=search)
            | Q(student_last_name__icontains=search)
            | Q(parent_first_name__icontains=search)
            | Q(parent_last_name__icontains=search)
            | Q(user__username__icontains=search)
            | Q(student_number__icontains=search)
        )

    if grade_level:
        qs = qs.filter(grade_level=grade_level)

    tuition_map = {
        t.grade_key: t
        for t in TuitionConfig.objects.filter(is_active=True, status='active')
    }

    data = []
    for profile in qs:
        student_name = " ".join(
            p for p in [
                profile.student_first_name,
                profile.student_middle_name,
                profile.student_last_name,
            ] if p
        ).strip()

        parent_name = " ".join(
            p for p in [
                profile.parent_first_name,
                profile.parent_middle_name,
                profile.parent_last_name,
            ] if p
        ).strip()

        payment_mode = (profile.payment_mode or '').strip().lower()
        grade_key = (profile.grade_level or '').strip().lower()
        tuition = tuition_map.get(grade_key)

        total_due = Decimal('0.00')
        total_paid = Decimal('0.00')
        account_status = 'PENDING'

        if tuition:
            if payment_mode == 'cash':
                total_due = Decimal(str(tuition.total_cash or 0))
            elif payment_mode == 'installment':
                total_due = sum((item['amount'] for item in build_installment_schedule(tuition)), Decimal('0.00'))

        if profile.user_id:
            total_paid = tuition_paid_for_parent(profile.user)

        remaining_balance = total_due - total_paid
        if remaining_balance < 0:
            remaining_balance = Decimal('0.00')

        if payment_mode == 'cash':
            account_status = compute_cash_status(total_due, total_paid)
        elif payment_mode == 'installment' and tuition:
            account_status = compute_installment_status(total_due, total_paid, tuition)

        data.append({
            'id': profile.id,
            'student_name': student_name or '—',
            'parent_name': parent_name or '—',
            'grade_level': profile.grade_level or '',
            'payment_mode': profile.payment_mode or '',
            'student_number': profile.student_number or '',
            'lrn': profile.lrn or '',
            'contact_number': profile.contact_number or '',
            'username': profile.user.username if profile.user else '',
            'total_due': float(total_due),
            'total_paid': float(total_paid),
            'remaining_balance': float(remaining_balance),
            'account_status': account_status,
        })

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_tuition_installments(request):
    if getattr(request.user, 'role', None) != 'PARENT_STUDENT':
        return Response({'detail': 'Forbidden'}, status=403)

    profiles = UserProfile.objects.filter(user=request.user).select_related('section')

    tuition_map = {
        t.grade_key: t
        for t in TuitionConfig.objects.filter(is_active=True, status='active')
    }

    today = date.today()
    data = []

    for profile in profiles:
        student_name = " ".join(
            p for p in [
                profile.student_first_name,
                profile.student_middle_name,
                profile.student_last_name,
            ] if p
        ).strip()

        payment_mode = (profile.payment_mode or '').strip().lower()
        grade_key = (profile.grade_level or '').strip().lower()
        tuition = tuition_map.get(grade_key)

        if not tuition:
            continue

        enrollment = Enrollment.objects.filter(
            parent_user=request.user,
            student_number=profile.student_number,
            status='ACTIVE'
        ).order_by('-created_at').first()

       

        total_paid = Decimal('0.00')
        installments = []

        payment_rows = []
        if enrollment:
            payment_rows = list(
                Transaction.objects.filter(
                    parent=request.user,
                    enrollment=enrollment,
                    transaction_type='TUITION',
                    entry_type='CREDIT',
                )
                .exclude(item='ADVANCE')
                .exclude(item='ADVANCE_APPLIED')
                .order_by('transaction_date', 'date_posted', 'id')
            )

            total_paid = sum(
                (Decimal(str(tx.credit or 0)) for tx in payment_rows),
                Decimal('0.00')
            )
        else:
            total_paid = tuition_paid_for_parent(profile.user)

        if payment_mode == 'installment':
            schedule = build_installment_schedule(tuition)

            # Clone payments so we can consume them sequentially like real allocation
            remaining_payments = [
                {
                    'id': tx.id,
                    'amount_left': Decimal(str(tx.credit or 0)),
                    'reference_number': tx.reference_number,
                    'transaction_date': tx.transaction_date.isoformat() if tx.transaction_date else None,
                    'item': tx.item,
                }
                for tx in payment_rows
                if Decimal(str(tx.credit or 0)) > 0
            ]

            for item in schedule:
                amount_due = Decimal(str(item['amount'] or 0))
                remaining_due = amount_due
                refs_used = []

                for payment in remaining_payments:
                    if remaining_due <= 0:
                        break
                    if payment['amount_left'] <= 0:
                        continue

                    applied = min(payment['amount_left'], remaining_due)
                    if applied > 0:
                        payment['amount_left'] -= applied
                        remaining_due -= applied

                        if payment['reference_number']:
                            refs_used.append(payment['reference_number'])

                paid_amount = amount_due - remaining_due
                is_paid = remaining_due <= 0
                is_overdue = (not is_paid) and (item['due_date'] < today)

                installments.append({
                    'type': item['type'],
                    'item': item['item'],
                    'amount': float(amount_due),
                    'amount_paid': float(paid_amount),
                    'balance': float(remaining_due if remaining_due > 0 else Decimal('0.00')),
                    'month': item['month'],
                    'due_date': item['due_date'].isoformat(),
                    'is_paid': is_paid,
                    'status': 'PAID' if is_paid else ('OVERDUE' if is_overdue else ('PARTIAL' if paid_amount > 0 else 'PENDING')),
                    'reference_number': refs_used[0] if len(refs_used) == 1 else None,
                    'reference_numbers': refs_used,
                })

            total_due = sum((item['amount'] for item in schedule), Decimal('0.00'))
            overall_status = compute_installment_status(total_due, total_paid, tuition)

        else:
            total_due = Decimal(str(tuition.total_cash or 0))
            overall_status = compute_cash_status(total_due, total_paid)

        remaining_balance = total_due - total_paid
        if remaining_balance < 0:
            remaining_balance = Decimal('0.00')

        data.append({
            'student_id': profile.id,
            'student_name': student_name or '—',
            'grade_level': profile.grade_level or '',
            'payment_mode': payment_mode,
            'total_due': float(total_due),
            'total_paid': float(total_paid),
            'remaining_balance': float(remaining_balance),
            'overall_status': overall_status,
            'installments': installments,
        })

    return Response(data)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pay_student_balance(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    student_number = str(request.data.get('student_number', '')).strip()
    amount_raw = request.data.get('amount')
    payment_method = str(request.data.get('payment_method', 'CASH')).strip().upper() or 'CASH'
    description = str(request.data.get('description', '')).strip()
    transaction_date = request.data.get('transaction_date')

    if not student_number:
        return Response({'detail': 'Student number is required.'}, status=400)

    try:
        amount = Decimal(str(amount_raw))
    except Exception:
        return Response({'detail': 'Invalid amount.'}, status=400)

    amount = normalize_money(amount)

    if amount <= 0:
        return Response({'detail': 'Amount must be greater than 0.'}, status=400)

    enrollment = get_active_enrollment_by_student_number(student_number)
    if not enrollment:
        return Response({'detail': 'Active enrollment not found for this student number.'}, status=404)

    if not enrollment.parent_user:
        return Response({'detail': 'Enrollment has no linked parent account.'}, status=400)

    total_debit, total_credit, current_balance = ledger_totals_for_enrollment(enrollment)

    if current_balance <= 0:
        return Response({
            'detail': 'This ledger has no outstanding balance.',
            'student_number': enrollment.student_number,
            'student_name': f"{enrollment.first_name or ''} {enrollment.last_name or ''}".strip(),
            'balance_before': float(max(current_balance, Decimal('0.00'))),
        }, status=400)

    applied_amount = amount if amount <= current_balance else current_balance
    excess_amount = amount - applied_amount if amount > current_balance else Decimal('0.00')

    student_name = f"{enrollment.first_name or ''} {enrollment.last_name or ''}".strip() or enrollment.student.username

    with db_transaction.atomic():
        payment_tx = Transaction.objects.create(
            parent=enrollment.parent_user,
            enrollment=enrollment,
            student_name=student_name,
            transaction_type='TUITION',
            entry_type='CREDIT',
            item='PAYMENT',
            school_year=enrollment.academic_year,
            semester='1st',
            amount=applied_amount,
            description=description or 'Payment posted via admin ledger payment.',
            payment_method=payment_method,
            transaction_date=transaction_date or timezone.localdate(),
            status='PAID' if applied_amount == current_balance else 'PARTIAL',
            student_number_snapshot=enrollment.student_number,
            grade_level_snapshot=enrollment.grade_level,
            payment_mode_snapshot=enrollment.payment_mode,
            student_type_snapshot=enrollment.student_type,
            reference_number=generate_transaction_reference(),
        )

        if excess_amount > 0:
            Transaction.objects.create(
                parent=enrollment.parent_user,
                enrollment=enrollment,
                student_name=student_name,
                transaction_type='TUITION',
                entry_type='CREDIT',
                item='ADVANCE',
                school_year=enrollment.academic_year,
                semester='1st',
                amount=excess_amount,
                description='Excess payment recorded as advance credit.',
                payment_method=payment_method,
                transaction_date=transaction_date or timezone.localdate(),
                status='PAID',
                student_number_snapshot=enrollment.student_number,
                grade_level_snapshot=enrollment.grade_level,
                payment_mode_snapshot=enrollment.payment_mode,
                student_type_snapshot=enrollment.student_type,
                reference_number=generate_transaction_reference(),
            )


            
        new_balance = recompute_running_balances_for_enrollment(enrollment)
        recompute_transaction_statuses_for_enrollment(enrollment)
        send_payment_received_reminder(sender=request.user, payment_tx=payment_tx)
        
    return Response({
        'success': True,
        'student_number': enrollment.student_number,
        'student_name': student_name,
        'enrollment_id': enrollment.id,
        'balance_before': float(current_balance),
        'paid_amount': float(amount),
        'applied_amount': float(applied_amount),
        'excess_amount': float(excess_amount),
        'new_balance': float(max(new_balance, Decimal('0.00'))),
        'status': compute_simple_ledger_status(new_balance),
        'payment_transaction_id': payment_tx.id,
        'has_overpayment': excess_amount > 0,
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refund_student_payment(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    student_number = str(request.data.get('student_number', '')).strip()
    amount_raw = request.data.get('amount')
    payment_method = str(request.data.get('payment_method', 'CASH')).strip().upper() or 'CASH'
    description = str(request.data.get('description', '')).strip()

    if not student_number:
        return Response({'detail': 'Student number is required.'}, status=400)

    try:
        amount = Decimal(str(amount_raw))
    except Exception:
        return Response({'detail': 'Invalid amount.'}, status=400)

    amount = normalize_money(amount)

    if amount <= 0:
        return Response({'detail': 'Refund amount must be greater than 0.'}, status=400)

    enrollment = get_active_enrollment_by_student_number(student_number)
    if not enrollment:
        return Response({'detail': 'Active enrollment not found for this student number.'}, status=404)

    if not enrollment.parent_user:
        return Response({'detail': 'Enrollment has no linked parent account.'}, status=400)

    refundable = get_available_advance_for_enrollment(enrollment)

    if refundable <= 0:
        return Response({'detail': 'No refundable excess payment found.'}, status=400)

    if amount > refundable:
        return Response({
            'detail': f'Refund exceeds refundable amount. Maximum refundable: {refundable}.'
        }, status=400)

    student_name = f"{enrollment.first_name or ''} {enrollment.last_name or ''}".strip() or enrollment.student.username

    with db_transaction.atomic():
        refund_tx = Transaction.objects.create(
            parent=enrollment.parent_user,
            enrollment=enrollment,
            student_name=student_name,
            transaction_type='TUITION',
            entry_type='DEBIT',
            item='REFUND',
            school_year=enrollment.academic_year,
            semester='1st',
            amount=amount,
            description=description or 'Refund issued for excess payment.',
            payment_method=payment_method,
            transaction_date=timezone.localdate(),
            status='POSTED',
            student_number_snapshot=enrollment.student_number,
            grade_level_snapshot=enrollment.grade_level,
            payment_mode_snapshot=enrollment.payment_mode,
            student_type_snapshot=enrollment.student_type,
            reference_number=generate_transaction_reference(),
        )


        new_balance = recompute_running_balances_for_enrollment(enrollment)
        recompute_transaction_statuses_for_enrollment(enrollment)
        
    return Response({
        'success': True,
        'student_number': enrollment.student_number,
        'student_name': student_name,
        'enrollment_id': enrollment.id,
        'refunded_amount': float(amount),
        'remaining_refundable': float(refundable - amount),
        'new_balance': float(max(new_balance, Decimal('0.00'))),
        'refund_transaction_id': refund_tx.id,
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_apply_advance(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    student_number = str(request.data.get('student_number', '')).strip()
    if not student_number:
        return Response({'detail': 'Student number is required.'}, status=400)

    enrollment = get_active_enrollment_by_student_number(student_number)
    if not enrollment:
        return Response({'detail': 'Active enrollment not found for this student number.'}, status=404)

    with db_transaction.atomic():
        applied_amount = auto_apply_previous_advance_to_enrollment(enrollment)
        _, _, new_balance = ledger_totals_for_enrollment(enrollment)

    return Response({
        'success': True,
        'student_number': enrollment.student_number,
        'enrollment_id': enrollment.id,
        'applied_amount': float(applied_amount),
        'new_balance': float(new_balance if new_balance > 0 else Decimal('0.00')),
        'status': 'PAID' if new_balance <= 0 else 'PARTIAL',
    }, status=200)
    
    
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def my_advance_requests(request):
    if getattr(request.user, 'role', None) != 'PARENT_STUDENT':
        return Response({'detail': 'Forbidden'}, status=403)

    if request.method == 'GET':
        qs = AdvanceRequest.objects.filter(user=request.user).select_related('enrollment')
        return Response(AdvanceRequestSerializer(qs, many=True).data)

    request_type = str(request.data.get('request_type', '')).strip().upper()
    amount_raw = request.data.get('amount')
    reason = str(request.data.get('reason', '')).strip()
    enrollment_id = request.data.get('enrollment')

    if request_type not in {'APPLY_ADVANCE', 'REFUND'}:
        return Response({'detail': 'Invalid request type.'}, status=400)

    try:
        amount = Decimal(str(amount_raw))
    except Exception:
        return Response({'detail': 'Invalid amount.'}, status=400)

    amount = normalize_money(amount)

    if amount <= 0:
        return Response({'detail': 'Amount must be greater than 0.'}, status=400)

    enrollment = None
    if enrollment_id:
        enrollment = Enrollment.objects.filter(
            id=enrollment_id,
            parent_user=request.user
        ).first()

    if not enrollment:
        return Response({'detail': 'Valid enrollment is required.'}, status=400)

    if request_type == 'REFUND':
        available = get_available_advance_for_enrollment(enrollment)
        if available <= 0:
            return Response({'detail': 'No available advance to refund.'}, status=400)
        if amount > available:
            return Response(
                {'detail': f'Request exceeds available advance: {available}.'},
                status=400
            )

    if request_type == 'APPLY_ADVANCE':
        _, _, current_balance = ledger_totals_for_enrollment(enrollment)
        if current_balance <= 0:
            return Response(
                {'detail': 'This enrollment has no outstanding balance to apply advance to.'},
                status=400
            )

    obj = AdvanceRequest.objects.create(
        user=request.user,
        enrollment=enrollment,
        request_type=request_type,
        amount=amount,
        reason=reason,
        status='PENDING',
    )

    return Response(AdvanceRequestSerializer(obj).data, status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def advance_requests_admin(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    qs = AdvanceRequest.objects.select_related('user', 'enrollment').all()
    return Response(AdvanceRequestSerializer(qs, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def process_advance_request(request, pk):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    obj = AdvanceRequest.objects.filter(pk=pk).select_related('enrollment', 'user').first()
    if not obj:
        return Response({'detail': 'Request not found.'}, status=404)

    action_type = str(request.data.get('action', '')).strip().upper()
    remarks = str(request.data.get('remarks', '')).strip()

    if action_type not in {'APPROVE', 'REJECT', 'PROCESS'}:
        return Response({'detail': 'Invalid action.'}, status=400)

    if obj.status == 'PROCESSED':
        return Response({'detail': 'This request has already been processed.'}, status=400)

    if obj.status == 'REJECTED' and action_type == 'PROCESS':
        return Response({'detail': 'Rejected requests cannot be processed.'}, status=400)

    if action_type == 'REJECT':
        obj.status = 'REJECTED'
        obj.admin_remarks = remarks
        obj.processed_at = timezone.now()
        obj.save(update_fields=['status', 'admin_remarks', 'processed_at', 'updated_at'])
        return Response({'success': True, 'status': obj.status})

    if action_type == 'APPROVE':
        obj.status = 'APPROVED'
        obj.admin_remarks = remarks
        obj.save(update_fields=['status', 'admin_remarks', 'updated_at'])
        return Response({'success': True, 'status': obj.status})

    if obj.status != 'APPROVED':
        return Response({'detail': 'Only approved requests can be processed.'}, status=400)

    if obj.request_type == 'APPLY_ADVANCE':
        if not obj.enrollment or not obj.enrollment.student_number:
            return Response({'detail': 'Enrollment or student number missing.'}, status=400)

        with db_transaction.atomic():
            applied_amount = auto_apply_previous_advance_to_enrollment(obj.enrollment)
            _, _, new_balance = ledger_totals_for_enrollment(obj.enrollment)

        obj.status = 'PROCESSED'
        obj.admin_remarks = remarks or f'Advance applied: {applied_amount}'
        obj.processed_at = timezone.now()
        obj.save(update_fields=['status', 'admin_remarks', 'processed_at', 'updated_at'])

        return Response({
            'success': True,
            'status': obj.status,
            'applied_amount': float(applied_amount),
            'new_balance': float(new_balance if new_balance > 0 else Decimal('0.00')),
        })

    if obj.request_type == 'REFUND':
        if not obj.enrollment or not obj.enrollment.student_number:
            return Response({'detail': 'Enrollment or student number missing.'}, status=400)

        available = get_available_advance_for_enrollment(obj.enrollment)
        if obj.amount > available:
            return Response(
                {'detail': f'Request exceeds available advance: {available}.'},
                status=400
            )

        student_name = (
            f"{obj.enrollment.first_name or ''} {obj.enrollment.last_name or ''}".strip()
            or obj.enrollment.student.username
        )

        with db_transaction.atomic():
            refund_tx = Transaction.objects.create(
                parent=obj.enrollment.parent_user,
                enrollment=obj.enrollment,
                student_name=student_name,
                transaction_type='TUITION',
                entry_type='DEBIT',
                item='REFUND',
                school_year=obj.enrollment.academic_year,
                semester='1st',
                amount=obj.amount,
                description=f"Refund processed from student request #{obj.id}.",
                payment_method='OTHER',
                transaction_date=timezone.localdate(),
                status='POSTED',
                student_number_snapshot=obj.enrollment.student_number,
                grade_level_snapshot=obj.enrollment.grade_level,
                payment_mode_snapshot=obj.enrollment.payment_mode,
                student_type_snapshot=obj.enrollment.student_type,
                reference_number=generate_transaction_reference(),
            )

            new_balance = recompute_running_balances_for_enrollment(obj.enrollment)
            recompute_transaction_statuses_for_enrollment(obj.enrollment)

        obj.status = 'PROCESSED'
        obj.admin_remarks = remarks or f'Refund transaction #{refund_tx.id} created.'
        obj.processed_at = timezone.now()
        obj.save(update_fields=['status', 'admin_remarks', 'processed_at', 'updated_at'])

        return Response({
            'success': True,
            'status': obj.status,
            'refund_transaction_id': refund_tx.id,
            'new_balance': float(new_balance if new_balance > 0 else Decimal('0.00')),
        })

    return Response({'detail': 'Unsupported request type.'}, status=400)
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
# ═══════════════════════════════════════════════════════════
# PROOF OF PAYMENT VIEWS
# ═══════════════════════════════════════════════════════════

class ProofOfPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = ProofOfPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.role == 'ADMIN':
            queryset = ProofOfPayment.objects.all().select_related('user', 'enrollment')
        else:
            queryset = ProofOfPayment.objects.filter(
                Q(user=self.request.user) | Q(enrollment__parent_user=self.request.user)
            ).select_related('user', 'enrollment').distinct()
        
        # Filter by status if provided
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        # Filter by payment type if provided
        payment_type = self.request.query_params.get('payment_type')
        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)
        
        return queryset
    
    def get_serializer_context(self):
        return {'request': self.request}
    
    def perform_create(self, serializer):
        enrollment = Enrollment.objects.filter(
            parent_user=self.request.user,
            status='ACTIVE'
        ).order_by('-created_at').first()

        serializer.save(
            user=self.request.user,
            payment_type='installment',
            source='student_portal',
            status='pending',
            enrollment=enrollment,
        )
    
    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAdminUser])
    def approve(self, request, pk=None):
        proof = self.get_object()

        if proof.status == 'approved':
            return Response(
                {'detail': 'This proof of payment has already been approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if proof.approved_transaction_id:
            return Response(
                {'detail': 'This proof is already linked to a posted transaction.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not proof.enrollment:
            return Response(
                {'detail': 'No active enrollment is linked to this proof of payment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not proof.enrollment.parent_user:
            return Response(
                {'detail': 'The linked enrollment has no parent account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount = Decimal(str(proof.amount or 0))
        if amount <= 0:
            return Response(
                {'detail': 'Proof amount must be greater than 0 before approval.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        proof.enrollment.refresh_from_db()
        student_name = (
            f"{proof.enrollment.first_name or ''} {proof.enrollment.last_name or ''}".strip()
            or proof.enrollment.student.username
        )

        with db_transaction.atomic():
            payment_tx = Transaction.objects.create(
                parent=proof.enrollment.parent_user,
                enrollment=proof.enrollment,
                student_name=student_name,
                transaction_type='TUITION',
                entry_type='CREDIT',
                item='PAYMENT',
                school_year=proof.enrollment.academic_year,
                semester='1st',
                amount=amount,
                description=proof.description or f'Payment posted from approved proof #{proof.id}.',
                payment_method='OTHER',
                transaction_date=timezone.localdate(),
                status='PAID',
                student_number_snapshot=proof.enrollment.student_number,
                grade_level_snapshot=proof.enrollment.grade_level,
                payment_mode_snapshot=proof.enrollment.payment_mode,
                student_type_snapshot=proof.enrollment.student_type,
                reference_number=proof.reference_number or generate_transaction_reference(),
            )

            new_balance = recompute_running_balances_for_enrollment(proof.enrollment)
            recompute_transaction_statuses_for_enrollment(proof.enrollment)

            proof.status = 'approved'
            proof.admin_remarks = request.data.get('remarks', '')
            proof.approved_transaction = payment_tx
            proof.save(update_fields=['status', 'admin_remarks', 'approved_transaction', 'updated_at'])

            send_payment_received_reminder(sender=request.user, payment_tx=payment_tx)

            create_reminder_once(
                recipient=proof.user,
                sender=request.user,
                title="Proof of Payment Approved",
                message=(
                    f"Your proof of payment has been approved.\n"
                    f"Reference Number: {proof.reference_number}\n"
                    f"Amount Paid: ₱{amount}\n"
                    f"Remaining Balance: ₱{max(new_balance, Decimal('0.00'))}"
                ),
                reminder_type="PAYMENT",
                event_type="PROOF_APPROVED",
                transaction=payment_tx,
                proof_of_payment=proof,
                reference_date=timezone.localdate(),
            )

            if proof.payment_type == 'enrollment' and proof.enrollment and proof.enrollment.status == 'PENDING':
                proof.enrollment.status = 'ACTIVE'
                proof.enrollment.save(update_fields=['status'])

        return Response({
            'status': 'approved',
            'message': 'Payment proof approved and payment posted successfully.',
            'transaction_id': payment_tx.id,
            'new_balance': float(max(new_balance, Decimal('0.00'))),
        })
        
        
    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAdminUser])
    def reject(self, request, pk=None):
        proof = self.get_object()

        if proof.status == 'approved':
            return Response(
                {'detail': 'Approved proofs cannot be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if proof.status == 'rejected':
            return Response(
                {'detail': 'This proof of payment has already been rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '').strip()

        proof.status = 'rejected'
        proof.admin_remarks = remarks
        proof.save(update_fields=['status', 'admin_remarks', 'updated_at'])

        create_reminder_once(
            recipient=proof.user,
            sender=request.user,
            title="Proof of Payment Rejected",
            message=(
                f"Your submitted proof of payment was rejected.\n"
                f"Reference Number: {proof.reference_number}\n"
                f"{f'Reason: {remarks}' if remarks else 'Please contact the school for clarification.'}"
            ),
            reminder_type="PAYMENT",
            event_type="PROOF_REJECTED",
            transaction=proof.approved_transaction,
            proof_of_payment=proof,
            reference_date=timezone.localdate(),
        )

        if proof.payment_type == 'enrollment' and proof.enrollment and proof.enrollment.status == 'PENDING':
            proof.enrollment.status = 'DROPPED'
            proof.enrollment.remarks = f"Payment proof rejected: {remarks or 'No reason provided'}"
            proof.enrollment.save(update_fields=['status', 'remarks'])

        return Response({'status': 'rejected', 'message': 'Payment proof rejected'}) 