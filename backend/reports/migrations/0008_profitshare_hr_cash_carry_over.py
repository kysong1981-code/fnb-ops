from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0007_partnershare_fixed_account_cash'),
    ]

    operations = [
        migrations.AddField(
            model_name='profitshare',
            name='hr_cash_total',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12, help_text='Total HR Cash collected during this period'),
        ),
        migrations.AddField(
            model_name='profitshare',
            name='carry_over_balance',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12, help_text='Carry-over from previous period (HR Cash - distributions)'),
        ),
    ]
