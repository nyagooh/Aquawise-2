import uuid
from django.contrib.gis.db import models as gis_models
from django.db import models


class MQTTBroker(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("core.Organisation", on_delete=models.CASCADE, related_name="mqtt_brokers")
    host = models.CharField(max_length=255)
    port = models.IntegerField(default=1883)
    username = models.CharField(max_length=255, blank=True)
    password = models.CharField(max_length=255, blank=True)
    topic_prefix = models.CharField(max_length=255, default="aquawise")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.host}:{self.port} ({self.organisation.name})"


class Sensor(models.Model):
    class SensorType(models.TextChoices):
        PRESSURE = "pressure", "Pressure"
        FLOW = "flow", "Flow Rate"
        TURBIDITY = "turbidity", "Turbidity"
        PH = "ph", "pH"
        CHLORINE = "chlorine", "Chlorine"
        TDS = "tds", "Total Dissolved Solids"
        TEMPERATURE = "temperature", "Temperature"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("core.Organisation", on_delete=models.CASCADE, related_name="sensors")
    network = models.ForeignKey("networks.WaterNetwork", on_delete=models.CASCADE, related_name="sensors")
    sensor_type = models.CharField(max_length=20, choices=SensorType.choices)
    name = models.CharField(max_length=255)
    external_id = models.CharField(max_length=100, blank=True, db_index=True)
    geometry = gis_models.PointField(srid=4326, null=True, blank=True)
    associated_pipe = models.ForeignKey(
        "networks.Pipe", on_delete=models.SET_NULL, null=True, blank=True, related_name="sensors"
    )
    associated_node = models.ForeignKey(
        "networks.Node", on_delete=models.SET_NULL, null=True, blank=True, related_name="sensors"
    )
    unit = models.CharField(max_length=20, default="bar")
    is_active = models.BooleanField(default=True)
    installed_at = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.sensor_type})"


class SensorReading(models.Model):
    class QualityFlag(models.TextChoices):
        GOOD = "good", "Good"
        SUSPECT = "suspect", "Suspect"
        BAD = "bad", "Bad"

    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name="readings", db_index=True)
    timestamp = models.DateTimeField(db_index=True)
    value = models.FloatField()
    unit = models.CharField(max_length=20)
    quality_flag = models.CharField(max_length=10, choices=QualityFlag.choices, default=QualityFlag.GOOD)

    class Meta:
        indexes = [models.Index(fields=["sensor", "timestamp"])]
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.sensor.name}: {self.value} {self.unit} @ {self.timestamp}"
