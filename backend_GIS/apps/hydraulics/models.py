import uuid
from django.db import models


class SimulationRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey("networks.WaterNetwork", on_delete=models.CASCADE, related_name="simulation_runs")
    created_by = models.ForeignKey("core.CustomUser", on_delete=models.SET_NULL, null=True)
    name = models.CharField(max_length=255, blank=True)
    inp_file_path = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    duration_seconds = models.FloatField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    wntr_version = models.CharField(max_length=20, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Run {self.name or self.pk} [{self.status}]"


class HydraulicScenario(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey("networks.WaterNetwork", on_delete=models.CASCADE, related_name="scenarios")
    name = models.CharField(max_length=255)
    base_run = models.ForeignKey(
        SimulationRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="derived_scenarios"
    )
    modifications = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Scenario: {self.name}"


class PressureResult(models.Model):
    run = models.ForeignKey(SimulationRun, on_delete=models.CASCADE, related_name="pressure_results", db_index=True)
    node_external_id = models.CharField(max_length=100, db_index=True)
    timestamp = models.DateTimeField(db_index=True)
    pressure_m = models.FloatField()

    class Meta:
        indexes = [models.Index(fields=["run", "node_external_id", "timestamp"])]
        ordering = ["timestamp"]


class FlowResult(models.Model):
    run = models.ForeignKey(SimulationRun, on_delete=models.CASCADE, related_name="flow_results", db_index=True)
    pipe_external_id = models.CharField(max_length=100, db_index=True)
    timestamp = models.DateTimeField(db_index=True)
    flow_lps = models.FloatField()
    velocity_mps = models.FloatField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["run", "pipe_external_id", "timestamp"])]
        ordering = ["timestamp"]
