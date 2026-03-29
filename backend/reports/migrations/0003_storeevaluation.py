from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
        ('reports', '0002_skyreport'),
    ]

    operations = [
        migrations.CreateModel(
            name='StoreEvaluation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period_type', models.CharField(choices=[('H1', 'H1 (Jan-Jun)'), ('H2', 'H2 (Jul-Dec)')], max_length=2)),
                ('year', models.IntegerField()),
                ('manager_type', models.CharField(choices=[('NON_EQUITY', 'Non-Equity Manager'), ('EQUITY', 'Equity Manager')], default='NON_EQUITY', max_length=10)),
                # Basic inputs
                ('net_profit', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('account_profit', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('cash_profit', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('guarantee_pct', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('guarantee_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive_pct', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('incentive_pool', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('equity_share', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('staff_count', models.IntegerField(default=0)),
                ('staff_incentive_pct', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                # Targets
                ('sales_target', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('cogs_target', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                ('wage_target', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                # Achievements
                ('sales_achievement', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('cogs_achievement', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                ('wage_achievement', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                ('service_rating', models.DecimalField(decimal_places=1, default=0, max_digits=3)),
                ('hygiene_months', models.IntegerField(default=0)),
                ('leadership_score', models.IntegerField(default=0)),
                # Auto-calculated scores
                ('sales_score', models.IntegerField(default=0)),
                ('cogs_score', models.IntegerField(default=0)),
                ('wage_score', models.IntegerField(default=0)),
                ('service_score', models.IntegerField(default=0)),
                ('hygiene_score', models.IntegerField(default=0)),
                ('leadership_score_points', models.IntegerField(default=0)),
                ('total_score', models.IntegerField(default=0)),
                ('payout_ratio', models.DecimalField(decimal_places=4, default=0, max_digits=5)),
                # Lock
                ('is_locked', models.BooleanField(default=False)),
                # Meta
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                # ForeignKeys
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='store_evaluations', to='users.userprofile')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='store_evaluations', to='users.organization')),
            ],
            options={
                'ordering': ['-year', '-period_type'],
                'indexes': [
                    models.Index(fields=['organization', 'year', 'period_type'], name='reports_sto_organiz_idx'),
                ],
                'unique_together': {('organization', 'year', 'period_type')},
            },
        ),
    ]
