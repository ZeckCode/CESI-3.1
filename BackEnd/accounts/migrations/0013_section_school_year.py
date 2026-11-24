from django.db import migrations, models
import django.db.models.deletion


def assign_existing_sections_to_active_school_year(apps, schema_editor):
    Section = apps.get_model("accounts", "Section")
    SchoolYear = apps.get_model("classmanagement", "SchoolYear")

    active_school_year = SchoolYear.objects.filter(is_active=True).first()
    if active_school_year is None:
        return

    Section.objects.filter(school_year__isnull=True).update(school_year=active_school_year)


class Migration(migrations.Migration):

    dependencies = [
        ("classmanagement", "0005_scheduletemplate"),
        ("accounts", "0012_teacherprofile_subjects"),
    ]

    operations = [
        migrations.AddField(
            model_name="section",
            name="school_year",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sections",
                to="classmanagement.schoolyear",
            ),
        ),
        migrations.RunPython(assign_existing_sections_to_active_school_year, migrations.RunPython.noop),
    ]
