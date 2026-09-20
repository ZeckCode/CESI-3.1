from datetime import date
from decimal import Decimal

from django.test import TestCase

from accounts.models import User
from enrollment.models import Enrollment
from finance.models import Transaction


class TransactionStatusAutoRefreshTests(TestCase):
    def test_targeted_payment_marks_selected_bill_paid(self):
        parent = User.objects.create_user(
            username="parent-targeted",
            email="targeted@example.com",
            password="StrongPass123!",
            role="PARENT_STUDENT",
        )
        student = User.objects.create_user(
            username="student-targeted",
            email="student-targeted@example.com",
            password="StrongPass123!",
            role="PARENT_STUDENT",
        )
        enrollment = Enrollment.objects.create(
            student=student,
            parent_user=parent,
            grade_level="grade1",
            status="ACTIVE",
            payment_mode="installment",
            academic_year="2024-2025",
            student_number="S-1003",
            first_name="Target",
            last_name="Student",
        )

        monthly = Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Target Student",
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="MONTHLY",
            amount=3000,
            due_date=date(2024, 6, 30),
            status="PENDING",
        )
        misc = Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Target Student",
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="MISC",
            amount=2000,
            due_date=date(2024, 8, 31),
            status="PENDING",
        )

        Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Target Student",
            transaction_type="TUITION",
            entry_type="CREDIT",
            item="PAYMENT",
            amount=2000,
            allocation_target=misc,
            status="PAID",
        )

        monthly.refresh_from_db()
        misc.refresh_from_db()
        self.assertNotEqual(monthly.status, "PAID")
        self.assertEqual(misc.status, "PAID")

    def test_payment_allocation_prefers_monthly_before_misc(self):
        parent = User.objects.create_user(
            username="parent-allocation",
            email="allocation@example.com",
            password="StrongPass123!",
            role="PARENT_STUDENT",
        )
        student = User.objects.create_user(
            username="student-allocation",
            email="student-allocation@example.com",
            password="StrongPass123!",
            role="PARENT_STUDENT",
        )
        enrollment = Enrollment.objects.create(
            student=student,
            parent_user=parent,
            grade_level="grade1",
            status="ACTIVE",
            payment_mode="installment",
            academic_year="2024-2025",
            student_number="S-1002",
            first_name="Alloc",
            last_name="Student",
        )

        monthly = Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Alloc Student",
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="MONTHLY",
            amount=3000,
            due_date=date(2024, 6, 30),
            status="PENDING",
            student_number_snapshot="S-1002",
            grade_level_snapshot="grade1",
            payment_mode_snapshot="installment",
            student_type_snapshot="new",
            reference_number="REF-MONTHLY-1",
        )

        misc = Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Alloc Student",
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="MISC",
            amount=2000,
            due_date=date(2024, 8, 31),
            status="PENDING",
            student_number_snapshot="S-1002",
            grade_level_snapshot="grade1",
            payment_mode_snapshot="installment",
            student_type_snapshot="new",
            reference_number="REF-MISC-1",
        )

        from finance.utils import get_payment_allocation_plan_for_enrollment

        plan = get_payment_allocation_plan_for_enrollment(enrollment, Decimal('3500.00'))

        self.assertEqual(plan[0]['item'], 'MONTHLY')
        self.assertEqual(plan[0]['amount'], 3000)
        self.assertEqual(plan[1]['item'], 'MISC')
        self.assertEqual(plan[1]['amount'], 500)
        self.assertEqual(monthly.status, 'PENDING')
        self.assertEqual(misc.status, 'PENDING')

    def test_credit_payment_recomputes_debit_status_to_paid(self):
        parent = User.objects.create_user(
            username="parent-auto-refresh",
            email="parent@example.com",
            password="StrongPass123!",
            role="PARENT_STUDENT",
        )
        student = User.objects.create_user(
            username="student-auto-refresh",
            email="student@example.com",
            password="StrongPass123!",
            role="PARENT_STUDENT",
        )
        enrollment = Enrollment.objects.create(
            student=student,
            parent_user=parent,
            grade_level="grade1",
            status="ACTIVE",
            payment_mode="installment",
            academic_year="2024-2025",
            student_number="S-1001",
            first_name="Auto",
            last_name="Student",
        )

        debit_tx = Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Auto Student",
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="INITIAL",
            amount=1000,
            due_date=date.today(),
            status="PENDING",
            student_number_snapshot="S-1001",
            grade_level_snapshot="grade1",
            payment_mode_snapshot="installment",
            student_type_snapshot="new",
            reference_number="REF-INIT-1",
        )

        Transaction.objects.create(
            parent=parent,
            enrollment=enrollment,
            student_name="Auto Student",
            transaction_type="TUITION",
            entry_type="CREDIT",
            item="PAYMENT",
            amount=1000,
            status="PAID",
            student_number_snapshot="S-1001",
            grade_level_snapshot="grade1",
            payment_mode_snapshot="installment",
            student_type_snapshot="new",
            reference_number="REF-PAY-1",
        )

        debit_tx.refresh_from_db()
        self.assertEqual(debit_tx.status, "PAID")
