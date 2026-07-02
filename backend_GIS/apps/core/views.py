from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        org = user.organisation
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': str(user.id),
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'organisation': {
                    'id': str(org.id),
                    'name': org.name,
                    'slug': org.slug,
                } if org else None,
            },
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        user = request.user
        org = user.organisation
        return Response({
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "organisation": {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
            } if org else None,
        })
