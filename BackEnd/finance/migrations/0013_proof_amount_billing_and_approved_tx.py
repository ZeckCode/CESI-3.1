from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
    ("finance", "0012_alter_transaction_item_advancerequest"),
    ]

    operations = [
        migrations.AddField(
            model_name="proofofpayment",
            name="amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="proofofpayment",
            name="billed_due_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="proofofpayment",
            name="billed_item",
            field=models.CharField(
                choices=[
                    ("PAYMENT", "General Payment"),
                    ("INITIAL", "Initial Payment"),
                    ("MONTHLY", "Monthly Installment"),
                    ("MISC", "Miscellaneous"),
                    ("REGISTRATION", "Registration"),
                    ("ASSESSMENT", "Assessment"),
                    ("OTHER", "Other"),
                ],
                default="PAYMENT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="proofofpayment",
            name="approved_transaction",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="approved_payment_proofs",
                to="finance.transaction",
            ),
        ),
    ]