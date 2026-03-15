from decimal import Decimal

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Q, Sum

from accounts.models import User, UserProfile
from .models import Transaction, TuitionConfig
from .serializers import (
    TransactionSerializer,
    TransactionCreateSerializer,
    ParentDropdownSerializer,
    TuitionConfigSerializer,
    TuitionConfigCreateSerializer,
)


# ──────────────────────────────────────────────
# ADMIN — list all transactions + create new
# ──────────────────────────────────────────────
class TransactionListCreate(generics.ListCreateAPIView):
    """
    GET  → list every transaction (admin panel)
    POST → create a new transaction from admin panel
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Transaction.objects.select_related('parent').all()
        search = self.request.query_params.get('search', '')
        status_filter = self.request.query_params.get('status', '')

        if search:
            qs = qs.filter(
                Q(student_name__icontains=search)
                | Q(reference_number__icontains=search)
                | Q(parent__username__icontains=search)
            )

        if status_filter and status_filter.upper() in ['PAID', 'PENDING', 'OVERDUE']:
            qs = qs.filter(status=status_filter.upper())

        return qs

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


# ──────────────────────────────────────────────
# ADMIN — detail / update / delete
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# ADMIN — financial summary stats
# ──────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_stats(request):
    if getattr(request.user, 'role', None) != 'ADMIN':
        return Response({'detail': 'Forbidden'}, status=403)

    total = Transaction.objects.aggregate(total=Sum('amount'))['total'] or 0
    collected = Transaction.objects.filter(status='PAID').aggregate(s=Sum('amount'))['s'] or 0
    pending = Transaction.objects.filter(status__in=['PENDING', 'OVERDUE']).aggregate(s=Sum('amount'))['s'] or 0

    return Response({
        'totalRevenue': float(total),
        'collected': float(collected),
        'pending': float(pending),
    })


# ──────────────────────────────────────────────
# ADMIN — parent search / dropdown list
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# ADMIN — students belonging to a parent account
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# PARENT — own transactions only
# ──────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_transactions(request):
    if getattr(request.user, 'role', None) != 'PARENT_STUDENT':
        return Response({'detail': 'Forbidden'}, status=403)

    qs = Transaction.objects.filter(parent=request.user).order_by('-date_created')
    serializer = TransactionSerializer(qs, many=True)
    return Response(serializer.data)


# ──────────────────────────────────────────────
# PARENT — ledger summary (totals + balance)
# ──────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_ledger_summary(request):
    if getattr(request.user, 'role', None) != 'PARENT_STUDENT':
        return Response({'detail': 'Forbidden'}, status=403)

    qs = Transaction.objects.filter(parent=request.user)

    total_billed = qs.aggregate(s=Sum('amount'))['s'] or 0
    total_paid = qs.filter(status='PAID').aggregate(s=Sum('amount'))['s'] or 0
    total_pending = qs.filter(status='PENDING').aggregate(s=Sum('amount'))['s'] or 0
    total_overdue = qs.filter(status='OVERDUE').aggregate(s=Sum('amount'))['s'] or 0
    balance = total_billed - total_paid

    return Response({
        'total_billed': float(total_billed),
        'total_paid': float(total_paid),
        'total_pending': float(total_pending),
        'total_overdue': float(total_overdue),
        'balance': float(balance),
    })


# ──────────────────────────────────────────────
# ADMIN — tuition config list/create
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# ADMIN — tuition config detail/update/delete
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# ADMIN — tuition config stats
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# PUBLIC — tuition config by grade
# ──────────────────────────────────────────────
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


# ──────────────────────────────────────────────
# ADMIN — student tuition overview
# ──────────────────────────────────────────────
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
        if tuition:
            if payment_mode == 'cash':
                total_due = tuition.total_cash or Decimal('0.00')
            elif payment_mode == 'installment':
                total_due = tuition.total_installment or Decimal('0.00')

        total_paid = Decimal('0.00')
        if profile.user_id:
            total_paid = (
                Transaction.objects.filter(parent=profile.user, status='PAID')
                .aggregate(total=Sum('amount'))
                .get('total') or Decimal('0.00')
            )

        remaining_balance = total_due - total_paid
        if remaining_balance < 0:
            remaining_balance = Decimal('0.00')

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
        })

    return Response(data)