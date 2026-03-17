from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from accounts.models import User
from finance.models import Transaction


class Command(BaseCommand):
    help = 'Add sample tuition transactions for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='isabella_torres',
            help='Username of parent account to add transactions for'
        )

    def handle(self, *args, **options):
        username = options['username']
        
        try:
            parent = User.objects.get(username=username, role='PARENT_STUDENT')
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Parent account "{username}" not found')
            )
            return

        # Get student name
        try:
            student_name = f"{parent.profile.student_first_name} {parent.profile.student_last_name}"
        except:
            student_name = "Student"

        # Sample transactions to add
        transactions_data = [
            {
                'transaction_type': 'TUITION',
                'amount': Decimal('15000.00'),
                'description': 'Initial Payment',
                'payment_method': 'BANK_TRANSFER',
                'due_date': '2026-05-31',
                'status': 'PAID',
                'date': timezone.make_aware(datetime(2026, 5, 15)),
            },
            {
                'transaction_type': 'TUITION',
                'amount': Decimal('15000.00'),
                'description': 'June Installment',
                'payment_method': 'BANK_TRANSFER',
                'due_date': '2026-06-30',
                'status': 'PAID',
                'date': timezone.make_aware(datetime(2026, 6, 20)),
            },
            {
                'transaction_type': 'TUITION',
                'amount': Decimal('15000.00'),
                'description': 'July Installment',
                'payment_method': 'BANK_TRANSFER',
                'due_date': '2026-07-31',
                'status': 'PAID',
                'date': timezone.make_aware(datetime(2026, 7, 15)),
            },
            {
                'transaction_type': 'TUITION',
                'amount': Decimal('15000.00'),
                'description': 'August Installment',
                'payment_method': 'BANK_TRANSFER',
                'due_date': '2026-08-31',
                'status': 'PENDING',
                'date': None,
            },
            {
                'transaction_type': 'MISC',
                'amount': Decimal('2500.00'),
                'description': 'Miscellaneous (August)',
                'payment_method': 'CASH',
                'due_date': '2026-08-31',
                'status': 'PENDING',
                'date': None,
            },
            {
                'transaction_type': 'TUITION',
                'amount': Decimal('15000.00'),
                'description': 'September Installment',
                'payment_method': 'BANK_TRANSFER',
                'due_date': '2026-09-30',
                'status': 'PENDING',
                'date': None,
            },
        ]

        created_count = 0
        for tx_data in transactions_data:
            date_created = tx_data.pop('date', None)
            
            tx = Transaction(
                parent=parent,
                student_name=student_name,
                **tx_data
            )
            
            # Override date_created if provided
            if date_created:
                tx.save()
                Transaction.objects.filter(pk=tx.pk).update(date_created=date_created)
            else:
                tx.save()
            
            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'✓ Created: {tx_data["description"]} - {tx_data["amount"]}')
            )

        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Successfully created {created_count} sample transactions for {student_name}')
        )
