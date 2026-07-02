import uuid
from django.db import models


class AnomalyDetectionModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("core.Organisation", on_delete=models.CASCADE, related_name="anomaly_models")
    network = models.ForeignKey("networks.WaterNetwork", on_delete=models.CASCADE, related_name="anomaly_models")
    model_type = models.CharField(max_length=50, default="IsolationForest")
    model_path = models.CharField(max_length=500)
    training_start = models.DateTimeField()
    training_end = models.DateTimeField()
    f1_score = models.FloatField(null=True, blank=True)
    contamination_rate = models.FloatField(default=0.05)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.model_type} model ({self.network.name})"


class AnomalyEvent(models.Model):
    class AnomalyType(models.TextChoices):
        PRESSURE_DROP = "pressure_drop", "Pressure Drop"
        PRESSURE_SPIKE = "pressure_spike", "Pressure Spike"
        FLOW_IMBALANCE = "flow_imbalance", "Flow Imbalance"
        QUALITY_DEVIATION = "quality_deviation", "Quality Deviation"
        SENSOR_FAULT = "sensor_fault", "Sensor Fault"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey("networks.WaterNetwork", on_delete=models.CASCADE, related_name="anomaly_events")
    sensor = models.ForeignKey(
        "sensors.Sensor", on_delete=models.SET_NULL, null=True, blank=True, related_name="anomaly_events"
    )
    anomaly_type = models.CharField(max_length=30, choices=AnomalyType.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    confidence = models.FloatField()
    detected_at = models.DateTimeField()
    description = models.TextField(blank=True)
    affected_zone = models.ForeignKey("networks.Zone", on_delete=models.SET_NULL, null=True, blank=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey("core.CustomUser", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-detected_at"]

    def __str__(self):
        return f"{self.anomaly_type} [{self.severity}] @ {self.detected_at}"


class LeakRiskScore(models.Model):
    pipe = models.OneToOneField("networks.Pipe", on_delete=models.CASCADE, related_name="leak_risk")
    risk_score = models.FloatField()
    risk_decile = models.IntegerField()
    material_age_score = models.FloatField(null=True, blank=True)
    pressure_variance_score = models.FloatField(null=True, blank=True)
    historical_break_score = models.FloatField(null=True, blank=True)
    computed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Risk {self.risk_score:.2f} — {self.pipe}"
