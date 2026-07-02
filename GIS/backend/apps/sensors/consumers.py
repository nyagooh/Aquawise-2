import json
from channels.generic.websocket import AsyncWebsocketConsumer


class SensorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.network_id = self.scope["url_route"]["kwargs"]["network_id"]
        self.group_name = f"network_{self.network_id}_sensors"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def sensor_reading(self, event):
        await self.send(text_data=json.dumps(event["data"]))
