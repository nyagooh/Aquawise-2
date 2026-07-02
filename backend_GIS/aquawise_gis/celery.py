import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aquawise_gis.settings.development")

app = Celery("aquawise_gis")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
