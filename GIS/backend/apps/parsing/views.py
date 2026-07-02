import logging

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .converter import convert_upload

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB


class NetworkParseView(APIView):
    """Stateless upload → GeoJSON.

    Accepts a single GIS file (.geojson/.json, zipped shapefile .zip, or
    .kml/.kmz), parses + reprojects it to WGS84 inline, and returns the
    { pipes, assets, meta } payload the React map renders directly. No
    persistence, no auth — built for the public demo.
    """

    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided. Attach it as form field 'file'."},
                            status=status.HTTP_400_BAD_REQUEST)
        if file.size and file.size > MAX_UPLOAD_BYTES:
            return Response({"error": "File exceeds the 100 MB upload limit."},
                            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        try:
            payload = convert_upload(file.name, file.read())
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception("Failed to parse upload %s", file.name)
            return Response(
                {"error": "Could not parse this file. Ensure it is a valid GeoJSON, "
                          "zipped shapefile, or KML/KMZ containing pipe geometry."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(payload, status=status.HTTP_200_OK)
