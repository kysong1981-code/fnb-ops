from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
        ('reports', '0003_storeevaluation'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProfitShare',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.IntegerField()),
                ('period_type', models.CharField(choices=[('H1', 'H1 (Apr-Sep)'), ('H2', 'H2 (Oct-Mar)')], max_length=2)),
                # Revenue
                ('account_revenue', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('account_25', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_revenue', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                # Tax
                ('tax', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                # Bank
                ('bank_account', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('bank_cash', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_bank', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                # Net Profit
                ('net_profit_account', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('net_profit_cash', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                # Incentive
                ('incentive_account', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive_cash', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive_total', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive_pct', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                # Lock & Notes
                ('is_locked', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True, default='')),
                # Meta
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                # ForeignKeys
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='profit_shares', to='users.userprofile')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='profit_shares', to='users.organization')),
            ],
            options={
                'ordering': ['-year', '-period_type'],
                'indexes': [
                    models.Index(fields=['organization', 'year', 'period_type'], name='reports_pro_organiz_idx'),
                ],
                'unique_together': {('organization', 'year', 'period_type')},
            },
        ),
        migrations.CreateModel(
            name='PartnerShare',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('partner_type', models.CharField(choices=[('EQUITY', 'Equity Partner'), ('NON_EQUITY', 'Non-Equity Partner'), ('OWNER', 'Owner')], default='EQUITY', max_length=10)),
                # Percentages
                ('incentive_pct', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                ('equity_pct', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                # Calculated amounts
                ('incentive_account', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive_cash', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('bank_account', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('bank_cash', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_account', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_cash', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                # Fixed amount
                ('fixed_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                # Notes & order
                ('notes', models.TextField(blank=True, default='')),
                ('order', models.IntegerField(default=0)),
                # ForeignKey
                ('profit_share', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='partners', to='reports.profitshare')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
    ]
