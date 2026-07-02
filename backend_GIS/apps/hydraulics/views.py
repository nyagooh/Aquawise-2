
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class SimulationRunListView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class SimulationRunDetailView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class PressureResultView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class PressureSpatialView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class FlowResultView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class ScenarioListView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)
