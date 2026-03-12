from django.db import migrations, models
import django.db.models.deletion


DEFAULT_JOB_TITLES = [
    ('STORE_MANAGER', 'Store Manager'),
    ('ASSISTANT_MANAGER', 'Assistant Manager'),
    ('SUPERVISOR', 'Supervisor'),
    ('BARISTA', 'Barista'),
    ('HEAD_CHEF', 'Head Chef'),
    ('CHEF', 'Chef'),
    ('COOK', 'Cook'),
    ('KITCHEN_HAND', 'Kitchen Hand'),
    ('SERVER', 'Server'),
    ('CASHIER', 'Cashier'),
    ('ALL_ROUNDER', 'All Rounder'),
    ('CLEANER', 'Cleaner'),
    ('OTHER', 'Other'),
]


def seed_job_titles(apps, schema_editor):
    Organization = apps.get_model('users', 'Organization')
    JobTitle = apps.get_model('users', 'JobTitle')

    for org in Organization.objects.all():
        for i, (code, label) in enumerate(DEFAULT_JOB_TITLES):
            JobTitle.objects.get_or_create(
                organization=org,
                code=code,
                defaults={'label': label, 'sort_order': i, 'is_active': True},
            )


def reverse_seed(apps, schema_editor):
    JobTitle = apps.get_model('users', 'JobTitle')
    codes = [c for c, _ in DEFAULT_JOB_TITLES]
    JobTitle.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_userprofile_managed_stores'),
    ]

    operations = [
        # Create JobTitle model
        migrations.CreateModel(
            name='JobTitle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=30)),
                ('label', models.CharField(max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_titles', to='users.organization')),
            ],
            options={
                'ordering': ['sort_order', 'label'],
                'unique_together': {('organization', 'code')},
            },
        ),
        # Remove choices from UserProfile.job_title
        migrations.AlterField(
            model_name='userprofile',
            name='job_title',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        # Seed default job titles
        migrations.RunPython(seed_job_titles, reverse_seed),
    ]
