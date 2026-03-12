from django.db import migrations


DEFAULT_CLEANING_AREAS = [
    'Kitchen',
    'Restroom',
    'Dining Area',
    'Fridge/Freezer',
    'Cooking Tools',
    'Floor',
    'Walls/Doors',
    'Trash Bins',
    'Other',
]


def seed_cleaning_areas(apps, schema_editor):
    Organization = apps.get_model('users', 'Organization')
    CleaningArea = apps.get_model('safety', 'CleaningArea')

    for org in Organization.objects.all():
        for i, name in enumerate(DEFAULT_CLEANING_AREAS):
            CleaningArea.objects.get_or_create(
                organization=org,
                name=name,
                defaults={'sort_order': i, 'is_active': True},
            )


def reverse_seed(apps, schema_editor):
    CleaningArea = apps.get_model('safety', 'CleaningArea')
    CleaningArea.objects.filter(name__in=DEFAULT_CLEANING_AREAS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('safety', '0006_add_cleaning_area'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_cleaning_areas, reverse_seed),
    ]
