"""
Lightweight settings for the public upload demo.

Standalone (does NOT import base.py): runs the stateless file-parsing endpoint
with no PostGIS, no Redis/Celery, no JWT auth. Backed by SQLite so `manage.py`
runs without external services. Start with:

    DJANGO_SETTINGS_MODULE=aquawise_gis.settings.demo \\
        python manage.py runserver 0.0.0.0:8000
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "demo-insecure-key-not-for-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
# Comma-separated hosts; defaults to open (fine for a public read-only demo API).
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "*").split(",") if h.strip()]
_render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if _render_host and _render_host not in ALLOWED_HOSTS and "*" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_host)

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.parsing",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "aquawise_gis.urls_demo"

TEMPLATES = []
WSGI_APPLICATION = "aquawise_gis.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "demo.sqlite3",
    }
}

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True

# CORS: restrict to specific origins when CORS_ALLOWED_ORIGINS is set
# (comma-separated, e.g. your Vercel URL); otherwise allow any origin so the
# open demo works from localhost and previews.
_cors = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _cors:
    CORS_ALLOWED_ORIGINS = _cors
else:
    CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}

# 100 MB upload ceiling (matches the view guard).
DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600
FILE_UPLOAD_MAX_MEMORY_SIZE = 104857600

# --- Email (demo-request / "Book a Walkthrough" lead capture) ---
# Where demo requests are delivered. Override with DEMO_LEAD_RECIPIENT.
DEMO_LEAD_RECIPIENT = os.environ.get("DEMO_LEAD_RECIPIENT", "annmaina.info@gmail.com")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Aquawise <no-reply@aquawise.io>")

# Real SMTP when EMAIL_HOST is set; otherwise print emails to the console so the
# demo works out-of-the-box without mail credentials.
if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["EMAIL_HOST"]
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
    EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "false").lower() == "true"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
