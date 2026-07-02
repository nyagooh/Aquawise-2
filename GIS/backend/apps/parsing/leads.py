"""
Demo-request / lead capture.

Gates the live demo behind a short form (work email + company + why) and powers
the "Book a Walkthrough" CTA. On submit we email the captured lead to the sales
inbox. Stateless + AllowAny — no account or login required to request a demo.
"""
import logging

from django.conf import settings
from django.core.mail import EmailMessage
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class DemoRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.EmailField()
    company = serializers.CharField(max_length=255)
    reason = serializers.CharField(max_length=2000)
    # "demo" = wants to open the live demo, "book" = wants a scheduled walkthrough
    kind = serializers.ChoiceField(choices=["demo", "book"], default="demo")


class DemoRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = DemoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        kind_label = "Walkthrough booking" if data["kind"] == "book" else "Live demo access"
        subject = f"[Aquawise] {kind_label} — {data['company']}"
        body = (
            f"New {kind_label.lower()} request from the Aquawise site.\n\n"
            f"Name:    {data['name'] or '(not provided)'}\n"
            f"Email:   {data['email']}\n"
            f"Company: {data['company']}\n\n"
            f"What they want to see / why:\n{data['reason']}\n"
        )
        recipient = getattr(settings, "DEMO_LEAD_RECIPIENT", settings.DEFAULT_FROM_EMAIL)

        try:
            EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
                reply_to=[data["email"]],
            ).send(fail_silently=False)
        except Exception:
            logger.exception("Failed to send demo-request email for %s", data["email"])
            return Response(
                {"error": "We couldn't send your request right now. Please email us directly."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        logger.info("Demo request (%s) from %s @ %s", data["kind"], data["email"], data["company"])
        return Response(
            {"ok": True, "message": "Thanks — your request has been received."},
            status=status.HTTP_201_CREATED,
        )
