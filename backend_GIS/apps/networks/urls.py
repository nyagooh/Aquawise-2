from django.urls import path
from . import views

urlpatterns = [
    path("", views.NetworkListView.as_view(), name="network-list"),
    path("upload/", views.NetworkUploadView.as_view(), name="network-upload"),
    path("<uuid:pk>/", views.WaterNetworkDetailView.as_view(), name="network-detail"),
    path("<uuid:pk>/validate/", views.NetworkValidationReportView.as_view(), name="network-validate"),
    path("<uuid:pk>/pipes/", views.PipeListView.as_view(), name="pipe-list"),
    path("<uuid:pk>/nodes/", views.NodeListView.as_view(), name="node-list"),
    path("<uuid:pk>/zones/", views.ZoneListView.as_view(), name="zone-list"),
    path("<uuid:pk>/assets/", views.AssetListView.as_view(), name="asset-list"),
    path("<uuid:pk>/stats/", views.NetworkStatsView.as_view(), name="network-stats"),
    path("<uuid:pk>/epanet/", views.EpanetUploadView.as_view(), name="network-epanet-upload"),
    path("<uuid:pk>/uploads/", views.NetworkUploadsListView.as_view(), name="network-uploads-list"),
]
