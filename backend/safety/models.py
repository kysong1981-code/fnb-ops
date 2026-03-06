from django.db import models
from users.models import Organization, UserProfile


class CleaningRecord(models.Model):
    """청소 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='cleaning_records')

    # 청소 정보
    date = models.DateField()
    area = models.CharField(max_length=255)  # 주방, 식탁, 화장실 등
    cleaned_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='cleaning_records')

    # 상태
    is_completed = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.area} - {self.date}"


class TemperatureRecord(models.Model):
    """온도 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='temperature_records')

    # 온도 정보
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=255)  # 냉장고, 냉동고 등
    temperature = models.DecimalField(max_digits=5, decimal_places=1)
    standard_temperature = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    recorded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='temperature_records')
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-time']
        indexes = [
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.location} - {self.temperature}°C"


class TrainingRecord(models.Model):
    """직원 교육 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='training_records')

    # 교육 정보
    date = models.DateField()
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # 참석자
    participants = models.ManyToManyField(UserProfile, related_name='training_records')

    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='trainings_created')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"{self.title} - {self.date}"
