
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class AlertRuleListView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class AlertRuleDetailView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class AlertEventListView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

class AlertEventDetailView(APIView):
    def get(self, request, pk=None):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def post(self, request):
        return Response({"detail": "Not yet implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)
