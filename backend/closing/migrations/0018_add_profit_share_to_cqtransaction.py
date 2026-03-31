from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0004_profitshare_partnershare'),
        ('closing', '0017_cqtransaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='cqtransaction',
            name='profit_share',
            field=models.ForeignKey(
                blank=True,
                help_text='Auto-created from ProfitShare lock',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='cq_transactions',
                to='reports.profitshare',
            ),
        ),
    ]
