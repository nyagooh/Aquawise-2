from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()

urlpatterns = [
    path("", include(router.urls)),
    path("networks/", include("apps.networks.urls")),
    path("hydraulics/", include("apps.hydraulics.urls")),
    path("sensors/", include("apps.sensors.urls")),
    path("analytics/", include("apps.analytics.urls")),
    path("alerts/", include("apps.alerts.urls")),
]
