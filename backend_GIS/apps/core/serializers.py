from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser, Organisation


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, default='', allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, default='', allow_blank=True)
    organisation_name = serializers.CharField(max_length=255)

    def validate_username(self, value):
        if CustomUser.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username is already taken.')
        return value

    def validate_email(self, value):
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def create(self, validated_data):
        org_name = validated_data.pop('organisation_name')
        base_slug = slugify(org_name) or 'org'
        slug = base_slug
        counter = 1
        while Organisation.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        org = Organisation.objects.create(name=org_name, slug=slug)

        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            organisation=org,
            role=CustomUser.Role.ADMIN,
        )
        return user
