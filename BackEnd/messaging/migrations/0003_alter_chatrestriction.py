# Generated migration for ChatRestriction model changes

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0002_chatrequest_messagereport'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chatrestriction',
            name='chat',
            field=models.ForeignKey(blank=True, help_text='Leave blank for global restriction (all chats)', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='restrictions', to='messaging.chat'),
        ),
        migrations.AlterUniqueTogether(
            name='chatrestriction',
            unique_together=set(),
        ),
    ]
