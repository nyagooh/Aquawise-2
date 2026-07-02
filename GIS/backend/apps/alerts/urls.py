from django.urls import path
from . import views

urlpatterns = [
    path("rules/", views.AlertRuleListView.as_view(), name="alert-rule-list"),
    path("rules/<uuid:pk>/", views.AlertRuleDetailView.as_view(), name="alert-rule-detail"),
    path("events/", views.AlertEventListView.as_view(), name="alert-event-list"),
    path("events/<uuid:pk>/", views.AlertEventDetailView.as_view(), name="alert-event-detail"),
]
