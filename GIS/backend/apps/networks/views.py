import json
import os

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.contrib.gis.geos import Polygon
from django.db.models import Case, CharField, Count, Sum, Value, When
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Asset, NetworkUpload, Node, Pipe, WaterNetwork, Zone


class NetworkListView(APIView):
    def get(self, request):
        networks = WaterNetwork.objects.filter(
            organisation=request.user.organisation
        ).order_by("-created_at")
        return Response([
            {
                "id": str(n.id),
                "name": n.name,
                "total_pipes": n.total_pipes,
                "total_nodes": n.total_nodes,
                "total_length_km": n.total_length_km,
                "source_crs": n.source_crs,
                "bbox": json.loads(n.bbox.geojson) if n.bbox else None,
                "created_at": n.created_at,
            }
            for n in networks
        ])


class NetworkUploadView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        ext = file.name.rsplit(".", 1)[-1].lower()
        if ext not in ("zip", "inp", "net"):
            return Response(
                {"error": "Only .zip (shapefile), .inp, or .net (EPANET) files accepted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_type = "shapefile" if ext == "zip" else f"epanet_{ext}"
        upload = NetworkUpload.objects.create(
            organisation=request.user.organisation,
            file_name=file.name,
            file_path="",
            file_type=file_type,
        )

        # Save file to media/uploads/<org_id>/<upload_id>.<ext>
        upload_dir = f"uploads/{request.user.organisation_id}"
        saved_path = default_storage.save(
            os.path.join(upload_dir, f"{upload.id}.{ext}"),
            ContentFile(file.read()),
        )
        upload.file_path = default_storage.path(saved_path)
        upload.save(update_fields=["file_path"])

        if ext == "zip":
            from .tasks import ingest_shapefile
            try:
                ingest_shapefile.delay(str(upload.id))
            except Exception:
                ingest_shapefile.apply(args=[str(upload.id)])

        return Response({"upload_id": str(upload.id), "status": upload.status}, status=status.HTTP_202_ACCEPTED)


class WaterNetworkDetailView(APIView):
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": str(network.id),
            "name": network.name,
            "source_crs": network.source_crs,
            "total_pipes": network.total_pipes,
            "total_nodes": network.total_nodes,
            "total_length_km": network.total_length_km,
            "bbox": json.loads(network.bbox.geojson) if network.bbox else None,
            "created_at": network.created_at,
        })

    def delete(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        network.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NetworkValidationReportView(APIView):
    def get(self, request, pk):
        try:
            upload = NetworkUpload.objects.get(pk=pk, organisation=request.user.organisation)
        except NetworkUpload.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": str(upload.id),
            "network_id": str(upload.network_id) if upload.network_id else None,
            "status": upload.status,
            "file_name": upload.file_name,
            "file_type": upload.file_type,
            "validation_report": upload.validation_report or {},
            "uploaded_at": upload.uploaded_at,
            "completed_at": upload.completed_at,
        })


def _bbox_filter(query_params):
    """Parse ?bbox=minx,miny,maxx,maxy and return a GEOSGeometry polygon, or None."""
    raw = query_params.get("bbox")
    if not raw:
        return None, None
    try:
        minx, miny, maxx, maxy = [float(v) for v in raw.split(",")]
    except (ValueError, TypeError):
        return None, "bbox must be four comma-separated numbers: minx,miny,maxx,maxy"
    bbox_geom = Polygon.from_bbox((minx, miny, maxx, maxy))
    bbox_geom.srid = 4326
    return bbox_geom, None


def _geojson_feature(geometry, properties):
    return {
        "type": "Feature",
        "geometry": json.loads(geometry.geojson),
        "properties": properties,
    }


class PipeListView(APIView):
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        qs = Pipe.objects.filter(network=network)

        bbox_geom, err = _bbox_filter(request.query_params)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
        if bbox_geom is not None:
            qs = qs.filter(geometry__intersects=bbox_geom)

        zone_id = request.query_params.get("zone")
        if zone_id:
            qs = qs.filter(zone_id=zone_id)

        features = [
            _geojson_feature(pipe.geometry, {
                "id": str(pipe.id),
                "external_id": pipe.external_id,
                "material": pipe.material,
                "diameter_mm": pipe.diameter_mm,
                "length_m": pipe.length_m,
                "status": pipe.status,
                "installation_year": pipe.installation_year,
                "zone_id": str(pipe.zone_id) if pipe.zone_id else None,
            })
            for pipe in qs.only(
                "id", "geometry", "external_id", "material",
                "diameter_mm", "length_m", "status", "installation_year", "zone_id",
            ).iterator(chunk_size=500)
        ]
        return Response({"type": "FeatureCollection", "features": features})


class NodeListView(APIView):
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        qs = Node.objects.filter(network=network)

        bbox_geom, err = _bbox_filter(request.query_params)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
        if bbox_geom is not None:
            qs = qs.filter(geometry__intersects=bbox_geom)

        zone_id = request.query_params.get("zone")
        if zone_id:
            qs = qs.filter(zone_id=zone_id)

        features = [
            _geojson_feature(node.geometry, {
                "id": str(node.id),
                "external_id": node.external_id,
                "node_type": node.node_type,
                "elevation_m": node.elevation_m,
                "demand_lps": node.demand_lps,
                "zone_id": str(node.zone_id) if node.zone_id else None,
            })
            for node in qs.only(
                "id", "geometry", "external_id", "node_type",
                "elevation_m", "demand_lps", "zone_id",
            ).iterator(chunk_size=500)
        ]
        return Response({"type": "FeatureCollection", "features": features})


class ZoneListView(APIView):
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        features = [
            _geojson_feature(zone.geometry, {
                "id": str(zone.id),
                "name": zone.name,
                "code": zone.code,
                "population_estimate": zone.population_estimate,
            })
            for zone in Zone.objects.filter(network=network)
            .exclude(geometry__isnull=True)
            .only("id", "geometry", "name", "code", "population_estimate")
            .iterator(chunk_size=200)
        ]
        return Response({"type": "FeatureCollection", "features": features})


class AssetListView(APIView):
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        bbox_geom, err = _bbox_filter(request.query_params)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)

        qs = Asset.objects.filter(network=network)
        if bbox_geom is not None:
            qs = qs.filter(geometry__intersects=bbox_geom)

        features = [
            _geojson_feature(asset.geometry, {
                "id": str(asset.id),
                "name": asset.name,
                "asset_type": asset.asset_type,
                "status": asset.status,
            })
            for asset in qs.only("id", "geometry", "name", "asset_type", "status").iterator(chunk_size=500)
        ]
        return Response({"type": "FeatureCollection", "features": features})


class NetworkStatsView(APIView):
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        pipes_qs = Pipe.objects.filter(network=network)

        materials = list(
            pipes_qs.values("material")
            .annotate(count=Count("id"), length_km=Sum("length_m"))
            .order_by("-count")
        )

        status_breakdown = {
            row["status"]: row["count"]
            for row in pipes_qs.values("status").annotate(count=Count("id"))
        }

        age_buckets = list(
            pipes_qs.annotate(
                bucket=Case(
                    When(installation_year__lt=2000, then=Value("pre-2000")),
                    When(installation_year__lt=2010, then=Value("2000-2009")),
                    When(installation_year__lt=2020, then=Value("2010-2019")),
                    When(installation_year__isnull=False, then=Value("2020+")),
                    default=Value("unknown"),
                    output_field=CharField(),
                )
            )
            .values("bucket")
            .annotate(count=Count("id"))
        )
        age_distribution = {row["bucket"]: row["count"] for row in age_buckets}

        zones_breakdown = []
        for zone in Zone.objects.filter(network=network):
            agg = pipes_qs.filter(zone=zone).aggregate(
                count=Count("id"), total_m=Sum("length_m")
            )
            zones_breakdown.append({
                "id": str(zone.id),
                "name": zone.name,
                "code": zone.code,
                "pipe_count": agg["count"] or 0,
                "length_km": round((agg["total_m"] or 0) / 1000, 3),
            })
        zones_breakdown.sort(key=lambda z: z["length_km"], reverse=True)

        nodes_qs = Node.objects.filter(network=network)
        nodes_breakdown = {
            row["node_type"]: row["count"]
            for row in nodes_qs.values("node_type").annotate(count=Count("id"))
        }

        return Response({
            "total_pipes": network.total_pipes,
            "total_nodes": network.total_nodes,
            "total_length_km": network.total_length_km,
            "materials_breakdown": [
                {
                    "material": m["material"],
                    "count": m["count"],
                    "length_km": round((m["length_km"] or 0) / 1000, 3),
                }
                for m in materials
            ],
            "status_breakdown": status_breakdown,
            "age_distribution": age_distribution,
            "zones_breakdown": zones_breakdown,
            "nodes_breakdown": nodes_breakdown,
        })


class EpanetUploadView(APIView):
    """Attach an EPANET .inp or .net file to an existing network."""
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        ext = file.name.rsplit(".", 1)[-1].lower()
        if ext not in ("inp", "net"):
            return Response(
                {"error": "Only .inp or .net EPANET files accepted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload = NetworkUpload.objects.create(
            organisation=request.user.organisation,
            network=network,
            file_name=file.name,
            file_path="",
            file_type=f"epanet_{ext}",
        )

        upload_dir = f"uploads/{request.user.organisation_id}"
        saved_path = default_storage.save(
            os.path.join(upload_dir, f"{upload.id}.{ext}"),
            ContentFile(file.read()),
        )
        upload.file_path = default_storage.path(saved_path)
        upload.save(update_fields=["file_path"])

        from .tasks import ingest_epanet
        try:
            ingest_epanet.delay(str(upload.id))
        except Exception:
            ingest_epanet.apply(args=[str(upload.id)])

        return Response(
            {"upload_id": str(upload.id), "status": upload.status},
            status=status.HTTP_202_ACCEPTED,
        )


class NetworkUploadsListView(APIView):
    """List all uploads (shapefile + EPANET) attached to a network."""
    def get(self, request, pk):
        try:
            network = WaterNetwork.objects.get(pk=pk, organisation=request.user.organisation)
        except WaterNetwork.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        uploads = NetworkUpload.objects.filter(network=network).order_by("-uploaded_at")
        # Also include the original shapefile upload (linked via WaterNetwork.upload)
        if network.upload_id:
            shp = network.upload
            data = [{
                "id": str(shp.id),
                "file_name": shp.file_name,
                "file_type": shp.file_type,
                "status": shp.status,
                "uploaded_at": shp.uploaded_at,
                "validation_report": shp.validation_report or {},
            }]
        else:
            data = []

        for u in uploads:
            data.append({
                "id": str(u.id),
                "file_name": u.file_name,
                "file_type": u.file_type,
                "status": u.status,
                "uploaded_at": u.uploaded_at,
                "validation_report": u.validation_report or {},
            })

        return Response(data)
