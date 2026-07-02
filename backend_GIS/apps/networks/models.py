import uuid
from django.contrib.gis.db import models as gis_models
from django.db import models


class NetworkUpload(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETE = "complete", "Complete"
        COMPLETE_WITH_WARNINGS = "complete_warnings", "Complete with Warnings"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("core.Organisation", on_delete=models.CASCADE, related_name="uploads")
    project = models.ForeignKey("core.Project", on_delete=models.CASCADE, null=True, blank=True)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    network = models.ForeignKey("WaterNetwork", on_delete=models.CASCADE, null=True, blank=True, related_name="uploads")
    file_type = models.CharField(max_length=20, choices=[
        ("shapefile", "Shapefile"),
        ("epanet", "EPANET .inp"),
        ("epanet_inp", "EPANET .inp"),
        ("epanet_net", "EPANET .net"),
    ])
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    validation_report = models.JSONField(default=dict, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.file_name} ({self.status})"


class WaterNetwork(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("core.Organisation", on_delete=models.CASCADE, related_name="networks")
    project = models.ForeignKey("core.Project", on_delete=models.CASCADE, null=True, blank=True)
    upload = models.OneToOneField(NetworkUpload, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    source_crs = models.CharField(max_length=50, blank=True)
    bbox = gis_models.PolygonField(srid=4326, null=True, blank=True)
    total_length_km = models.FloatField(null=True, blank=True)
    total_pipes = models.IntegerField(default=0)
    total_nodes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.organisation.name})"


class Zone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey(WaterNetwork, on_delete=models.CASCADE, related_name="zones")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    geometry = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)
    population_estimate = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.network.name})"


class Pipe(models.Model):
    class Material(models.TextChoices):
        PVC = "PVC", "PVC"
        GI = "GI", "Galvanized Iron"
        HDPE = "HDPE", "HDPE"
        STEEL = "Steel", "Steel"
        PPR = "PPR", "PPR"
        CI = "CI", "Cast Iron"
        ASBESTOS = "AC", "Asbestos Cement"
        UNKNOWN = "Unknown", "Unknown"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        OUT_OF_SERVICE = "out_of_service", "Out of Service"
        PENDING = "pending", "Pending"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey(WaterNetwork, on_delete=models.CASCADE, related_name="pipes")
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True, related_name="pipes")
    external_id = models.CharField(max_length=100, blank=True, db_index=True)
    geometry = gis_models.MultiLineStringField(srid=4326)
    material = models.CharField(max_length=20, choices=Material.choices, default=Material.UNKNOWN)
    diameter_mm = models.FloatField(null=True, blank=True)
    roughness = models.FloatField(null=True, blank=True)
    length_m = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    installation_year = models.IntegerField(null=True, blank=True)
    network_type = models.CharField(max_length=50, blank=True)
    remarks = models.TextField(blank=True)
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [gis_models.Index(fields=["network", "zone", "status", "material"])]

    def __str__(self):
        return f"Pipe {self.external_id or self.pk} ({self.material}, {self.diameter_mm}mm)"


class Node(models.Model):
    class NodeType(models.TextChoices):
        JUNCTION = "junction", "Junction"
        RESERVOIR = "reservoir", "Reservoir"
        TANK = "tank", "Tank"
        METER = "meter", "Meter"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey(WaterNetwork, on_delete=models.CASCADE, related_name="nodes")
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True, related_name="nodes")
    external_id = models.CharField(max_length=100, blank=True, db_index=True)
    node_type = models.CharField(max_length=20, choices=NodeType.choices, default=NodeType.JUNCTION)
    geometry = gis_models.PointField(srid=4326)
    elevation_m = models.FloatField(null=True, blank=True)
    demand_lps = models.FloatField(null=True, blank=True)
    attributes = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Node {self.external_id or self.pk} ({self.node_type})"


class Asset(models.Model):
    class AssetType(models.TextChoices):
        PUMP = "pump", "Pump"
        VALVE = "valve", "Valve"
        METER = "meter", "Flow Meter"
        TREATMENT_PLANT = "treatment_plant", "Treatment Plant"
        BOREHOLE = "borehole", "Borehole"
        INTAKE = "intake", "Water Intake"
        STORAGE_TANK = "storage_tank", "Storage Tank"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey(WaterNetwork, on_delete=models.CASCADE, related_name="assets")
    asset_type = models.CharField(max_length=30, choices=AssetType.choices)
    name = models.CharField(max_length=255)
    geometry = gis_models.PointField(srid=4326)
    status = models.CharField(max_length=20, default="active")
    attributes = models.JSONField(default=dict, blank=True)
    installed_at = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.asset_type})"
