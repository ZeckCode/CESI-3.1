from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_alter_adminprofile_id_alter_passwordresetrequest_id_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="status",
            field=models.CharField(
                choices=[
                    ("NEW", "New"),
                    ("ACTIVE", "Active"),
                    ("INACTIVE", "Inactive"),
                    ("SUSPENDED", "Suspended"),
                    ("TRANSFERRED", "Transferred"),
                ],
                default="ACTIVE",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="allow_transfer_with_balance",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="destination_school_address",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="destination_school_contact",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="destination_school_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="is_read_only",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="outstanding_balance_snapshot",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="approved_transfers",
                to="accounts.user",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_clearance",
            field=models.FileField(blank=True, null=True, upload_to="transfer_clearance/"),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_notes",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_reason",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_reference_number",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_requested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="transfer_status",
            field=models.CharField(
                choices=[
                    ("NONE", "None"),
                    ("PENDING", "Pending"),
                    ("APPROVED", "Approved"),
                    ("REJECTED", "Rejected"),
                ],
                default="NONE",
                max_length=20,
            ),
        ),
    ]
