import uuid
from django.db import models


class AlertRule(models.Model):
    class Operator(models.TextChoices):
        LT = "lt", "Less than"
        GT = "gt", "Greater than"
        LTE = "lte", "Less than or equal"
        GTE = "gte", "Greater than or equal"
        EQ = "eq", "Equal to"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("core.Organisation", on_delete=models.CASCADE, related_name="alert_rules")
    network = models.ForeignKey("networks.WaterNetwork", on_delete=models.CASCADE, related_name="alert_rules")
    name = models.CharField(max_length=255)
    sensor_type = models.CharField(max_length=20, blank=True)
    zone = models.ForeignKey("networks.Zone", on_delete=models.SET_NULL, null=True, blank=True)
    sensor = models.ForeignKey("sensors.Sensor", on_delete=models.SET_NULL, null=True, blank=True)
    metric = models.CharField(max_length=50)
    operator = models.CharField(max_length=5, choices=Operator.choices)
    threshold = models.FloatField()
    duration_seconds = models.IntegerField(default=0)
    severity = models.CharField(max_length=10, default="medium")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name}: {self.metric} {self.operator} {self.threshold}"


class AlertEvent(models.Model):
    class AlertStatus(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, related_name="events")
    anomaly_event = models.ForeignKey(
        "analytics.AnomalyEvent", on_delete=models.SET_NULL, null=True, blank=True, related_name="alert_events"
    )
    status = models.CharField(max_length=15, choices=AlertStatus.choices, default=AlertStatus.OPEN)
    severity = models.CharField(max_length=10, default="medium")
    triggered_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey("core.CustomUser", on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField(blank=True)

    class Meta:
        ordering = ["-triggered_at"]

    def __str__(self):
        return f"Alert [{self.severity}] {self.status} @ {self.triggered_at}"


class Notification(models.Model):
    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        PUSH = "push", "Push"
        WEBSOCKET = "websocket", "WebSocket"

    class DeliveryStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_event = models.ForeignKey(AlertEvent, on_delete=models.CASCADE, related_name="notifications")
    recipient = models.ForeignKey("core.CustomUser", on_delete=models.CASCADE, related_name="notifications")
    channel = models.CharField(max_length=15, choices=Channel.choices)
    status = models.CharField(max_length=10, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    def __str__(self):
        return f"{self.channel} → {self.recipient.username} [{self.status}]"
