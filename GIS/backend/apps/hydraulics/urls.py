from django.urls import path
from . import views

urlpatterns = [
    path("runs/", views.SimulationRunListView.as_view(), name="simulation-run-list"),
    path("runs/<uuid:pk>/", views.SimulationRunDetailView.as_view(), name="simulation-run-detail"),
    path("runs/<uuid:pk>/results/pressure/", views.PressureResultView.as_view(), name="pressure-results"),
    path("runs/<uuid:pk>/results/pressure/spatial/", views.PressureSpatialView.as_view(), name="pressure-spatial"),
    path("runs/<uuid:pk>/results/flow/", views.FlowResultView.as_view(), name="flow-results"),
    path("scenarios/", views.ScenarioListView.as_view(), name="scenario-list"),
]
