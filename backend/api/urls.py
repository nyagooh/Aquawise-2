from django.urls import path
from . import views

urlpatterns = [
    path('regions/', views.regions),
    path('sensor-readings/', views.sensor_readings),
    path('timeseries/', views.timeseries),
    path('water-sources/', views.water_sources),
    path('alerts/', views.alerts),
    path('predictions/', views.predictions),
    path('ingest/', views.ingest),
]
