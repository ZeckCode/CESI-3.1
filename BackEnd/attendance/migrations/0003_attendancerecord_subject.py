from django.db import migrations, models
import django.db.models.deletion


def backfill_subject_from_schedule(apps, schema_editor):
    AttendanceRecord = apps.get_model("attendance", "AttendanceRecord")

    # Backfill subject for rows that already have schedule-linked subjects.
    queryset = AttendanceRecord.objects.filter(
        subject__isnull=True,
        schedule__isnull=False,
        schedule__subject__isnull=False,
    ).values_list("id", "schedule__subject_id")

    for record_id, subject_id in queryset:
        AttendanceRecord.objects.filter(id=record_id).update(subject_id=subject_id)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_passwordresetrequest"),
        ("attendance", "0002_alter_attendancerecord_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="subject",
            field=models.ForeignKey(
                blank=True,
                help_text="Canonical subject snapshot for this attendance record",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="attendance_records",
                to="accounts.subject",
            ),
        ),
        migrations.RunPython(backfill_subject_from_schedule, migrations.RunPython.noop),
    ]
