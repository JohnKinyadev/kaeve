import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from .models import AuthToken


ACCESS_TOKEN_LIFETIME = timedelta(days=1)
REFRESH_TOKEN_LIFETIME = timedelta(days=7)


def hash_token(raw_token):
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_token(user, token_type):
    raw_token = secrets.token_urlsafe(48)
    lifetime = ACCESS_TOKEN_LIFETIME
    if token_type == AuthToken.TokenType.REFRESH:
        lifetime = REFRESH_TOKEN_LIFETIME

    AuthToken.objects.create(
        user=user,
        token_hash=hash_token(raw_token),
        token_type=token_type,
        expires_at=timezone.now() + lifetime,
    )
    return raw_token


def create_token_pair(user):
    return {
        "access": create_token(user, AuthToken.TokenType.ACCESS),
        "refresh": create_token(user, AuthToken.TokenType.REFRESH),
        "token_type": "Bearer",
        "access_expires_in_seconds": int(ACCESS_TOKEN_LIFETIME.total_seconds()),
        "refresh_expires_in_seconds": int(REFRESH_TOKEN_LIFETIME.total_seconds()),
    }


def get_active_token(raw_token, token_type):
    token = (
        AuthToken.objects.select_related("user", "user__profile")
        .filter(token_hash=hash_token(raw_token), token_type=token_type)
        .first()
    )
    if token and token.is_active:
        return token
    return None
