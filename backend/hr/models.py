from django.db import models
from users.models import Organization, UserProfile


class Roster(models.Model):
    """근무 스케줄"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='rosters')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='rosters')

    # 스케줄 정보
    date = models.DateField()
    shift_start = models.TimeField()
    shift_end = models.TimeField()
    is_confirmed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        unique_together = ('user', 'date')
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.date} ({self.shift_start}-{self.shift_end})"

    @property
    def hours(self):
        """근무 시간 계산"""
        from datetime import datetime, timedelta
        start = datetime.combine(self.date, self.shift_start)
        end = datetime.combine(self.date, self.shift_end)
        if end < start:
            end += timedelta(days=1)
        return (end - start).total_seconds() / 3600


class Timesheet(models.Model):
    """타임시트 (출퇴근 기록)"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='timesheets')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='timesheets')

    # 근무 기록
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)

    # 상태
    is_approved = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        unique_together = ('user', 'date')
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.date}"

    @property
    def worked_hours(self):
        """실제 근무 시간"""
        if self.check_in and self.check_out:
            return (self.check_out - self.check_in).total_seconds() / 3600
        return 0
