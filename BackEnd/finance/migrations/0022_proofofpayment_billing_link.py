from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0021_transaction_allocation_target'),
    ]

    operations = [
        migrations.AddField(
            model_name='proofofpayment',
            name='bill_transaction',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='payment_proofs_for_bill',
                to='finance.transaction',
            ),
        ),
        migrations.AddField(
            model_name='proofofpayment',
            name='payment_channel',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
