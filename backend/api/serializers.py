from rest_framework import serializers
from .models import Region, WaterSource, SensorParameter, TimeSeriesReading, Alert, RegionPrediction, ForecastDay


class RegionSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='region_id')

    class Meta:
        model = Region
        fields = ['id', 'name', 'water_body']


class WaterSourceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='source_id')
    regionId = serializers.CharField(source='region.region_id')
    lastUpdated = serializers.SerializerMethodField()

    class Meta:
        model = WaterSource
        fields = ['id', 'name', 'regionId', 'risk', 'lastUpdated']

    def get_lastUpdated(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.last_updated
        minutes = int(delta.total_seconds() / 60)
        if minutes < 60:
            return f'{minutes} min ago'
        hours = minutes // 60
        return f'{hours} hr ago'


class SensorParameterSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='param_id')
    safeMin = serializers.FloatField(source='safe_min')
    safeMax = serializers.FloatField(source='safe_max')
    isReal = serializers.BooleanField(source='is_real')

    class Meta:
        model = SensorParameter
        fields = ['id', 'name', 'value', 'unit', 'safeMin', 'safeMax', 'isReal', 'description']


class TimeSeriesReadingSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    dissolvedOxygen = serializers.FloatField(source='dissolved_oxygen')

    class Meta:
        model = TimeSeriesReading
        fields = ['time', 'temperature', 'turbidity', 'ph', 'dissolvedOxygen', 'conductivity', 'nitrates']

    def get_time(self, obj):
        return obj.timestamp.strftime('%I:%M %p')


class AlertSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='alert_id')
    time = serializers.CharField(source='time_label')
    regionId = serializers.CharField(source='region.region_id')

    class Meta:
        model = Alert
        fields = ['id', 'time', 'source', 'regionId', 'parameter', 'value', 'risk', 'action']


class ForecastDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastDay
        fields = ['day', 'score']


class RegionPredictionSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='region.region_id')
    region = serializers.CharField(source='region.name')
    waterBody = serializers.CharField(source='region.water_body')
    riskScore = serializers.IntegerField(source='risk_score')
    riskLevel = serializers.CharField(source='risk_level')
    prediction = serializers.CharField(source='prediction_text')
    nextRisk = serializers.CharField(source='next_risk')
    contaminationProbability = serializers.IntegerField(source='contamination_probability')
    topConcern = serializers.CharField(source='top_concern')
    forecastDays = ForecastDaySerializer(source='forecast_days', many=True)

    class Meta:
        model = RegionPrediction
        fields = [
            'id', 'region', 'waterBody', 'riskScore', 'riskLevel',
            'prediction', 'nextRisk', 'contaminationProbability',
            'topConcern', 'forecastDays',
        ]
