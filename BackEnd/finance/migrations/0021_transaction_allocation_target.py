from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0020_alter_advancerequest_id_alter_proofofpayment_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='allocation_target',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='allocated_payments',
                to='finance.transaction',
            ),
        ),
    ]
