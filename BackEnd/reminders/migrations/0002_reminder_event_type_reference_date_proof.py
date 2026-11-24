from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0012_alter_transaction_item_advancerequest"),
        ("reminders", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="reminder",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("PAYMENT_RECEIVED", "Payment Received"),
                    ("PAYMENT_DUE", "Payment Due"),
                    ("PAYMENT_OVERDUE", "Payment Overdue"),
                    ("PROOF_APPROVED", "Proof Approved"),
                    ("PROOF_REJECTED", "Proof Rejected"),
                    ("PERFORMANCE_ALERT", "Performance Alert"),
                    ("STAR_AWARD", "Star Award"),
                    ("GENERAL_NOTICE", "General Notice"),
                ],
                default="GENERAL_NOTICE",
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="reminder",
            name="proof_of_payment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reminders",
                to="finance.proofofpayment",
            ),
        ),
        migrations.AddField(
            model_name="reminder",
            name="reference_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="reminder",
            constraint=models.UniqueConstraint(
                fields=("recipient", "transaction", "event_type", "reference_date"),
                name="uniq_reminder_recipient_transaction_event_refdate",
            ),
        ),
    ]