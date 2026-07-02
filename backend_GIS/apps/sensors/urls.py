from django.urls import path
from . import views

urlpatterns = [
    path("", views.SensorListView.as_view(), name="sensor-list"),
    path("<uuid:pk>/", views.SensorDetailView.as_view(), name="sensor-detail"),
    path("<uuid:pk>/readings/", views.SensorReadingView.as_view(), name="sensor-readings"),
    path("summary/", views.SensorSummaryView.as_view(), name="sensor-summary"),
]
