from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0006_skyreport_is_locked_locked_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='partnershare',
            name='fixed_account',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='partnershare',
            name='fixed_cash',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
