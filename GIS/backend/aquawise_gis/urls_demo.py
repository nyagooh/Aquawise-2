"""URL routing for the lightweight upload demo (aquawise_gis.settings.demo)."""
from django.http import JsonResponse
from django.urls import path

from apps.parsing.views import NetworkParseView
from apps.parsing.leads import DemoRequestView


def healthz(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("api/v1/parse/", NetworkParseView.as_view(), name="network-parse"),
    path("api/v1/demo-request/", DemoRequestView.as_view(), name="demo-request"),
]
