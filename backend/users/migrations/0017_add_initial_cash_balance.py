from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0016_add_annual_salary'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='initial_cash_balance',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Initial cash balance before first import', max_digits=12),
        ),
        migrations.AddField(
            model_name='organization',
            name='initial_balance_date',
            field=models.DateField(blank=True, help_text='Date of initial cash balance (data starts after this date)', null=True),
        ),
    ]
