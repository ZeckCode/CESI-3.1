from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("classmanagement", "0001_initial"),
        ("accounts", "0007_teacherprofile_avatar_userprofile_avatar"),
    ]

    operations = [
        migrations.AddField(
            model_name="section",
            name="room",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="sections",
                to="classmanagement.room",
            ),
        ),
    ]
