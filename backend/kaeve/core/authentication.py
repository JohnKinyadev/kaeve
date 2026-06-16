from django.contrib.auth.models import AnonymousUser
from rest_framework import authentication, exceptions

from .auth_tokens import get_active_token
from .models import AuthToken


class AuthTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode("utf-8")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            return None

        token = get_active_token(parts[1], AuthToken.TokenType.ACCESS)
        if token is None:
            raise exceptions.AuthenticationFailed("Invalid or expired access token.")

        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword
