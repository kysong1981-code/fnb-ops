from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0018_alter_organization_parent'),
        ('closing', '0019_merge_20260401_0637'),
    ]

    operations = [
        migrations.AddField(
            model_name='cqtransaction',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='cqtransaction',
            name='locked_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cq_transactions_locked',
                to='users.userprofile',
            ),
        ),
    ]
