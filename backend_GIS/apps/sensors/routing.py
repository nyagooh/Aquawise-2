from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/sensors/(?P<network_id>[0-9a-f-]+)/$", consumers.SensorConsumer.as_asgi()),
]
