"""
Development seed script — loads the Kisumu shapefile as a test network.

Usage:
    python manage.py shell < scripts/seed_dev.py
    # or
    python scripts/seed_dev.py  (after setting DJANGO_SETTINGS_MODULE)
"""
import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aquawise_gis.settings.development")
django.setup()

from apps.core.models import Organisation, CustomUser, Project

org, _ = Organisation.objects.get_or_create(
    slug="kiwasco-kisumu",
    defaults={"name": "KIWASCO — Kisumu Water & Sewerage", "country": "Kenya", "city": "Kisumu", "timezone": "Africa/Nairobi"},
)
print(f"Organisation: {org}")

user, created = CustomUser.objects.get_or_create(
    username="admin",
    defaults={"email": "admin@aquawise.io", "organisation": org, "role": "admin", "is_staff": True, "is_superuser": True},
)
if created:
    user.set_password("admin123")
    user.save()
    print(f"Created superuser: admin / admin123")
else:
    print(f"User already exists: {user.username}")

project, _ = Project.objects.get_or_create(
    organisation=org,
    name="Kisumu Water Network 2024",
    defaults={"description": "4,947 pipe segments, 790 km, imported from shapefile", "created_by": user},
)
print(f"Project: {project}")
print("\nDev data seeded. Next steps:")
print("  1. Upload the Kisumu shapefile to /api/v1/networks/upload/")
print("  2. Check validation report at /api/v1/networks/<id>/validate/")
