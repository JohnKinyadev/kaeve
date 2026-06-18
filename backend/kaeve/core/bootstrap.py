import os

from django.contrib.auth import get_user_model
from django.db import OperationalError, ProgrammingError, connection

from .models import UserProfile


def bootstrap_admin_from_env():
    if os.environ.get("DJANGO_BOOTSTRAP_ADMIN", "").lower() not in {"1", "true", "yes"}:
        return

    username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "").strip()
    password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
    email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "").strip()

    if not username or not password:
        return

    user_model = get_user_model()

    try:
        if user_model._meta.db_table not in connection.introspection.table_names():
            return

        user, _ = user_model.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.ADMIN
        profile.save(update_fields=["role", "updated_at"])
    except (OperationalError, ProgrammingError):
        return
