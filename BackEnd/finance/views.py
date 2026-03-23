from decimal import Decimal
from datetime import date

from django.db.models import Q, Sum
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from accounts.models import User, UserProfile
from .models import Transaction, TuitionConfig
from .serializers import (
    TransactionSerializer,
    TransactionCreateSerializer,
    ParentDropdownSerializer,
    TuitionConfigSerializer,
    TuitionConfigCreateSerializer,
)


def build_installment_schedule(tuition):
    items = []

    initial = Decimal(str(tuition.initial or 0))
    monthly = Decimal(str(tuition.monthly or 0))
    misc_aug = Decimal(str(tuition.misc_aug or 0))
    misc_nov = Decimal(str(tuition.misc_nov or 0))

    if initial > 0:
        items.append({
            'type': 'Initial Payment',
            'item': 'INITIAL',
            'month': 'May',
            'amount': initial,
            'due_date': date(2026, 5, 31),
        })

    months = [
        ('June', date(2026, 6, 30)),
        ('July', date(2026, 7, 31)),
        ('August', date(2026, 8, 31)),
        ('September', date(2026, 9, 30)),
        ('October', date(2026, 10, 31)),
        ('November', date(2026, 11, 30)),
        ('December', date(2026, 12, 31)),
        ('January', date(2027, 1, 31)),
        ('February', date(2027, 2, 28)),
        ('March', date(2027, 3, 31)),
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

    if misc_aug > 0:
        items.append({
            'type': 'Miscellaneous (August)',
            'item': 'MISC',
            'month': 'August',
            'amount': misc_aug,
            'due_date': date(2026, 8, 31),
        })

    if misc_nov > 0:
        items.append({
            'type': 'Miscellaneous (November)',
            'item': 'MISC',
            'month': 'November',
            'amount': misc_nov,
            'due_date': date(2026, 11, 30),
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

        if search:
            qs = qs.filter(
                Q(student_name__icontains=search)
                | Q(reference_number__icontains=search)
                | Q(parent__profile__student_first_name__icontains=search)
                | Q(parent__profile__student_last_name__icontains=search)
                | Q(parent__profile__student_number__icontains=search)
                | Q(item__icontains=search)
            ).distinct()

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

    total_billed, total_paid, balance = ledger_totals_for_parent(request.user)

    return Response({
        'total_billed': float(total_billed),
        'total_paid': float(total_paid),
        'balance': float(balance),
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
                total_due = Decimal(str(tuition.total_installment or 0))

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

        total_paid = tuition_paid_for_parent(profile.user)

        installments = []

        if payment_mode == 'installment':
            schedule = build_installment_schedule(tuition)
            covered = Decimal('0.00')

            for item in schedule:
                amount = item['amount']
                next_covered = covered + amount

                is_paid = total_paid >= next_covered
                is_overdue = (not is_paid) and (item['due_date'] < today)

                installments.append({
                    'type': item['type'],
                    'item': item['item'],
                    'amount': float(amount),
                    'month': item['month'],
                    'due_date': item['due_date'].isoformat(),
                    'is_paid': is_paid,
                    'status': 'PAID' if is_paid else ('OVERDUE' if is_overdue else 'PENDING'),
                })
                covered = next_covered

            total_due = Decimal(str(tuition.total_installment or 0))
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