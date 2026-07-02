from django.urls import path
from . import views

urlpatterns = [
    path("anomalies/", views.AnomalyEventListView.as_view(), name="anomaly-list"),
    path("leak-risk/", views.LeakRiskView.as_view(), name="leak-risk"),
    path("demand-forecast/", views.DemandForecastView.as_view(), name="demand-forecast"),
]
