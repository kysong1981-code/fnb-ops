from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0013_add_inquiry_model'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employeeinvite',
            name='job_title',
            field=models.CharField(max_length=30),
        ),
        migrations.AlterField(
            model_name='documenttemplate',
            name='job_title',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
    ]
