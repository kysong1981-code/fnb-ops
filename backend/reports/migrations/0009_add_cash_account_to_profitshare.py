from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0008_profitshare_hr_cash_carry_over'),
    ]

    operations = [
        migrations.AddField(
            model_name='profitshare',
            name='cash_account',
            field=models.CharField(
                choices=[('QT', 'QT'), ('ChCh', 'ChCh')],
                default='QT',
                help_text='Which cash account this store sends to',
                max_length=10,
            ),
        ),
    ]
