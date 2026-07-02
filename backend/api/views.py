from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import Region, WaterSource, SensorParameter, TimeSeriesReading, Alert, RegionPrediction, StationReading
from .serializers import (
    RegionSerializer, WaterSourceSerializer, SensorParameterSerializer,
    TimeSeriesReadingSerializer, AlertSerializer, RegionPredictionSerializer,
)


@api_view(['GET'])
def regions(request):
    qs = Region.objects.all()
    return Response(RegionSerializer(qs, many=True).data)


@api_view(['GET'])
def sensor_readings(request):
    qs = SensorParameter.objects.all()
    return Response(SensorParameterSerializer(qs, many=True).data)


@api_view(['GET'])
def timeseries(request):
    qs = TimeSeriesReading.objects.all().order_by('timestamp')
    return Response(TimeSeriesReadingSerializer(qs, many=True).data)


@api_view(['GET'])
def water_sources(request):
    qs = WaterSource.objects.select_related('region').all()
    region_id = request.query_params.get('region')
    if region_id:
        qs = qs.filter(region__region_id=region_id)
    return Response(WaterSourceSerializer(qs, many=True).data)


@api_view(['GET'])
def alerts(request):
    qs = Alert.objects.select_related('region').all()
    region_id = request.query_params.get('region')
    if region_id:
        qs = qs.filter(region__region_id=region_id)
    return Response(AlertSerializer(qs, many=True).data)


@api_view(['GET'])
def predictions(request):
    qs = RegionPrediction.objects.select_related('region').prefetch_related('forecast_days').all()
    region_id = request.query_params.get('region')
    if region_id:
        qs = qs.filter(region__region_id=region_id)
    return Response(RegionPredictionSerializer(qs, many=True).data)


# ── Ingest ─────────────────────────────────────────────────────────────────────

PARAM_MAP = {
    'temperature':      'temperature',
    'turbidity':        'turbidity',
    'ph':               'ph',
    'dissolved_oxygen': 'dissolved_oxygen',
    'conductivity':     'conductivity',
    'nitrates':         'nitrates',
}


@api_view(['POST'])
def ingest(request):
    """
    Receive a sensor payload from a physical station and persist it.

    Expected JSON:
    {
        "station": "Dunga Beach Station",
        "temperature": 25.3,
        "turbidity": 3.1,
        "ph": 7.2,
        "dissolved_oxygen": 8.0,
        "conductivity": 415.0,
        "nitrates": 4.1
    }
    """
    data = request.data

    # Resolve station (optional — reading is saved even if station not found)
    station_name = data.get('station', '').strip()
    station = WaterSource.objects.filter(name__iexact=station_name).first()

    # Build the field dict from the payload
    fields = {k: data[k] for k in PARAM_MAP if k in data}

    if not fields:
        return Response({'error': 'No sensor values provided.'}, status=status.HTTP_400_BAD_REQUEST)

    # Persist the raw station reading
    reading = StationReading.objects.create(station=station, **fields)

    # Update the live SensorParameter values so the dashboard reflects reality
    for field, param_id in PARAM_MAP.items():
        if field in fields:
            SensorParameter.objects.filter(param_id=param_id).update(value=fields[field])

    # Also append to the time-series so charts stay fresh
    TimeSeriesReading.objects.create(
        timestamp=timezone.now(),
        temperature=fields.get('temperature', 0),
        turbidity=fields.get('turbidity', 0),
        ph=fields.get('ph', 0),
        dissolved_oxygen=fields.get('dissolved_oxygen', 0),
        conductivity=fields.get('conductivity', 0),
        nitrates=fields.get('nitrates', 0),
    )

    return Response({
        'id': reading.pk,
        'station': station.name if station else station_name or None,
        'timestamp': reading.timestamp,
        'fields_saved': list(fields.keys()),
    }, status=status.HTTP_201_CREATED)
