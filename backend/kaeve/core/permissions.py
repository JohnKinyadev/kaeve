from functools import wraps

from django.contrib.auth.models import AnonymousUser
from django.http import JsonResponse
from rest_framework.permissions import BasePermission

from .auth_tokens import get_active_token
from .models import AuthToken, UserProfile


ADMIN_ROLE = UserProfile.Role.ADMIN
MANAGER_ROLE = UserProfile.Role.MANAGER
SECRETARY_ROLE = UserProfile.Role.SECRETARY
FIELD_OFFICER_ROLE = UserProfile.Role.FIELD_OFFICER
MEMBER_ROLE = UserProfile.Role.MEMBER


def get_user_role(user):
    if not user.is_authenticated:
        return None
    if user.is_superuser or user.is_staff:
        return ADMIN_ROLE
    return getattr(getattr(user, "profile", None), "role", None)


def authenticate_request(request):
    if request.user.is_authenticated:
        return

    auth_header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if not auth_header.startswith(prefix):
        return

    raw_token = auth_header.removeprefix(prefix).strip()
    token = get_active_token(raw_token, AuthToken.TokenType.ACCESS)
    request.user = token.user if token else AnonymousUser()


def user_has_role(user, allowed_roles):
    role = get_user_role(user)
    return role in allowed_roles


def role_required(*allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            authenticate_request(request)
            if not request.user.is_authenticated:
                return JsonResponse(
                    {"detail": "Authentication credentials were not provided."},
                    status=401,
                )
            if not user_has_role(request.user, allowed_roles):
                return JsonResponse(
                    {"detail": "You do not have permission to perform this action."},
                    status=403,
                )
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


class RoleBasedAdminMixin:
    role_permissions = {
        FIELD_OFFICER_ROLE: {
            "member": {"view"},
            "season": {"view"},
            "collectionpoint": {"view"},
            "delivery": {"view", "add", "change"},
            "loan": {"view"},
            "inventorystock": {"view"},
        },
        SECRETARY_ROLE: {
            "member": {"view"},
            "season": {"view"},
            "collectionpoint": {"view"},
            "delivery": {"view", "add", "change"},
            "loan": {"view", "add"},
            "payout": {"view"},
            "ledgerentry": {"view"},
        },
        MEMBER_ROLE: {
            "member": {"view"},
            "delivery": {"view"},
            "loan": {"view"},
            "payout": {"view"},
            "ledgerentry": {"view"},
        },
    }

    def get_model_name(self):
        return self.model._meta.model_name

    def has_role_permission(self, request, action):
        if get_user_role(request.user) == ADMIN_ROLE:
            return True
        if get_user_role(request.user) == MANAGER_ROLE:
            return action in {"view", "add", "change"}
        return action in self.role_permissions.get(get_user_role(request.user), {}).get(
            self.get_model_name(),
            set(),
        )

    def has_module_permission(self, request):
        if get_user_role(request.user) == ADMIN_ROLE:
            return True
        if get_user_role(request.user) == MANAGER_ROLE:
            return True
        return bool(self.role_permissions.get(get_user_role(request.user), {}).get(self.get_model_name()))

    def has_view_permission(self, request, obj=None):
        return self.has_role_permission(request, "view")

    def has_add_permission(self, request):
        return self.has_role_permission(request, "add")

    def has_change_permission(self, request, obj=None):
        return self.has_role_permission(request, "change")

    def has_delete_permission(self, request, obj=None):
        return self.has_role_permission(request, "delete")

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if get_user_role(request.user) != MEMBER_ROLE:
            return queryset

        model_name = self.get_model_name()
        if model_name == "member":
            return queryset.filter(user=request.user)
        if model_name in {"delivery", "loan", "payout", "ledgerentry"}:
            return queryset.filter(member__user=request.user)
        return queryset.none()


class RoleBasedApiPermission(BasePermission):
    role_permissions = {
        FIELD_OFFICER_ROLE: {
            "member": {"view"},
            "season": {"view"},
            "collectionpoint": {"view"},
            "delivery": {"view", "add", "change"},
            "loan": {"view"},
            "inventorystock": {"view"},
        },
        SECRETARY_ROLE: {
            "member": {"view"},
            "season": {"view"},
            "collectionpoint": {"view"},
            "delivery": {"view", "add", "change"},
            "loan": {"view", "add"},
            "payout": {"view"},
            "ledgerentry": {"view"},
        },
        MEMBER_ROLE: {
            "member": {"view"},
            "delivery": {"view"},
            "loan": {"view"},
            "payout": {"view"},
            "ledgerentry": {"view"},
        },
    }

    action_map = {
        "list": "view",
        "retrieve": "view",
        "create": "add",
        "update": "change",
        "partial_update": "change",
        "destroy": "delete",
        "approve": "change",
        "reject": "change",
    }

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        role = get_user_role(request.user)
        if role == ADMIN_ROLE:
            return True
        if role == MANAGER_ROLE:
            return self.action_map.get(view.action, "view") in {"view", "add", "change"}

        model_name = view.queryset.model._meta.model_name
        action = self.action_map.get(view.action, "view")
        return action in self.role_permissions.get(role, {}).get(model_name, set())
