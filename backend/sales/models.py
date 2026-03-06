from django.db import models
from users.models import Organization, UserProfile


class Sales(models.Model):
    """매출 데이터"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sales')

    # 날짜 및 시간
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)

    # 매출 데이터
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    # 기타
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-time']
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.date}: {self.amount}"
