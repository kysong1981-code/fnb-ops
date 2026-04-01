from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
        ('reports', '0005_rename_reports_pro_organiz_idx_reports_pro_organiz_beecd0_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='skyreport',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='skyreport',
            name='locked_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='locked_sky_reports',
                to='users.userprofile',
            ),
        ),
    ]
