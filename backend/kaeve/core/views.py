import json
import os
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.core import signing
from django.db import transaction
from django.db.models import Count, Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .auth_tokens import create_token, create_token_pair, get_active_token
from .models import (
    AuthToken,
    CollectionPoint,
    Delivery,
    InventoryStock,
    LedgerEntry,
    Loan,
    Member,
    MillingBatch,
    Payout,
    SaleProceed,
    Season,
    UserProfile,
)
from .permissions import (
    ADMIN_ROLE,
    FIELD_OFFICER_ROLE,
    MANAGER_ROLE,
    MEMBER_ROLE,
    SECRETARY_ROLE,
    RoleBasedApiPermission,
    get_user_role,
    role_required,
)
from .serializers import (
    CollectionPointSerializer,
    DeliverySerializer,
    InventoryStockSerializer,
    LedgerEntrySerializer,
    LoanSerializer,
    MemberSerializer,
    MillingBatchSerializer,
    PayoutSerializer,
    PayoutStatementSerializer,
    SaleProceedSerializer,
    SeasonSerializer,
    UserProfileSerializer,
)
from .services import (
    approve_loan,
    generate_season_payouts,
    get_payout_statement,
    reject_loan,
    reverse_delivery_effects,
    reverse_milling_batch_effects,
    sync_delivery_effects,
    sync_loan_ledger_entry,
    sync_milling_batch_effects,
)


def health_check(request):
    return JsonResponse({"status": "ok", "service": "coffee-cooperative-api"})


SOCIAL_AUTH_PROVIDERS = {
    "google": {
        "client_id_env": "GOOGLE_OAUTH_CLIENT_ID",
        "client_secret_env": "GOOGLE_OAUTH_CLIENT_SECRET",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "profile_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "client_id_env": "GITHUB_OAUTH_CLIENT_ID",
        "client_secret_env": "GITHUB_OAUTH_CLIENT_SECRET",
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "profile_url": "https://api.github.com/user",
        "scope": "read:user user:email",
    },
}


def frontend_auth_redirect_url():
    return os.environ.get("FRONTEND_AUTH_REDIRECT_URL", "http://localhost:5173").rstrip("/")


def oauth_redirect_uri(request, provider):
    return request.build_absolute_uri(f"/api/auth/social/{provider}/callback/")


def json_post(url, payload):
    request = Request(
        url,
        data=urlencode(payload).encode("utf-8"),
        headers={"Accept": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def json_get(url, access_token):
    request = Request(url, headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"})
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def unique_social_username(base_username):
    user_model = get_user_model()
    base = "".join(char if char.isalnum() or char in "-_." else "-" for char in base_username).strip("-_.")
    base = base[:120] or "social-user"
    username = base
    suffix = 1

    while user_model.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base[:112]}-{suffix}"

    return username


def get_or_create_social_user(provider, profile):
    user_model = get_user_model()

    if provider == "google":
        provider_id = profile.get("sub")
        email = profile.get("email") or ""
        display_name = profile.get("name") or email
    else:
        provider_id = str(profile.get("id") or "")
        email = profile.get("email") or f"github-{provider_id}@users.noreply.github.com"
        display_name = profile.get("name") or profile.get("login") or email

    username = email or f"{provider}-{provider_id}"
    user = user_model.objects.filter(email__iexact=email).first() if email else None

    if user is None:
        user = user_model.objects.create_user(
            username=unique_social_username(username.split("@")[0]),
            email=email,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])

    if not getattr(user, "profile", None):
        UserProfile.objects.create(user=user, role=UserProfile.Role.MEMBER)
    elif not user.profile.role:
        user.profile.role = UserProfile.Role.MEMBER
        user.profile.save(update_fields=["role", "updated_at"])

    if display_name and not user.first_name:
        parts = display_name.split(" ", 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ""
        user.save(update_fields=["first_name", "last_name"])

    return user


def create_user_account(payload, default_role=UserProfile.Role.MEMBER, allow_privileged_roles=False):
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    role = payload.get("role") or default_role
    member_fields = {
        "full_name": (payload.get("full_name") or "").strip(),
        "national_id": (payload.get("national_id") or "").strip(),
        "phone_number": (payload.get("phone_number") or "").strip(),
        "farm_size_acres": payload.get("farm_size_acres"),
        "location": (payload.get("location") or "").strip(),
        "membership_number": (payload.get("membership_number") or "").strip(),
    }

    if not username:
        return None, JsonResponse({"detail": "Username is required."}, status=400)
    if not password:
        return None, JsonResponse({"detail": "Password is required."}, status=400)
    if role not in UserProfile.Role.values:
        return None, JsonResponse(
            {
                "detail": "Invalid role.",
                "allowed_roles": list(UserProfile.Role.values),
            },
            status=400,
        )
    if not allow_privileged_roles and role != UserProfile.Role.MEMBER:
        return None, JsonResponse(
            {"detail": "Public registration only allows member accounts."},
            status=403,
        )

    user_model = get_user_model()
    if user_model.objects.filter(username=username).exists():
        return None, JsonResponse({"detail": "Username is already taken."}, status=400)
    if email and user_model.objects.filter(email=email).exists():
        return None, JsonResponse({"detail": "Email is already taken."}, status=400)

    provided_member_fields = any(member_fields.values())
    if role == UserProfile.Role.MEMBER and provided_member_fields:
        missing_fields = [
            field
            for field in ("full_name", "national_id", "farm_size_acres", "location")
            if not member_fields[field]
        ]
        if missing_fields:
            return None, JsonResponse(
                {
                    "detail": "Member profile details are incomplete.",
                    "missing_fields": missing_fields,
                },
                status=400,
            )
        if Member.objects.filter(national_id=member_fields["national_id"]).exists():
            return None, JsonResponse({"detail": "National ID is already registered."}, status=400)
        if member_fields["membership_number"] and Member.objects.filter(
            membership_number=member_fields["membership_number"]
        ).exists():
            return None, JsonResponse({"detail": "Membership number is already registered."}, status=400)

    with transaction.atomic():
        user = user_model.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_staff=role == UserProfile.Role.ADMIN,
            is_superuser=role == UserProfile.Role.ADMIN,
        )
        user.profile.role = role
        user.profile.phone_number = member_fields["phone_number"]
        user.profile.save(update_fields=["role", "phone_number", "updated_at"])

        if role == UserProfile.Role.MEMBER and provided_member_fields:
            membership_number = member_fields["membership_number"] or f"MEM{user.id:05d}"
            Member.objects.create(
                user=user,
                membership_number=membership_number,
                full_name=member_fields["full_name"],
                national_id=member_fields["national_id"],
                phone_number=member_fields["phone_number"],
                farm_size_acres=member_fields["farm_size_acres"],
                location=member_fields["location"],
            )

    return user, None


class RoleScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleBasedApiPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering = ["-created_at"]
    exact_filter_fields = ()

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in self.exact_filter_fields:
            value = self.request.query_params.get(field)
            if value in (None, ""):
                continue
            if value.lower() == "true":
                value = True
            elif value.lower() == "false":
                value = False
            queryset = queryset.filter(**{field: value})

        if get_user_role(self.request.user) != MEMBER_ROLE:
            return queryset

        model_name = queryset.model._meta.model_name
        if model_name == "member":
            return queryset.filter(user=self.request.user)
        if model_name in {"delivery", "loan", "payout", "ledgerentry"}:
            return queryset.filter(member__user=self.request.user)
        return queryset.none()


class AdminOnlyPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and get_user_role(request.user) == ADMIN_ROLE)


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related("user").all()
    serializer_class = UserProfileSerializer
    permission_classes = [AdminOnlyPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["user__username", "user__email", "phone_number", "role"]
    ordering_fields = ["role", "created_at", "updated_at"]
    ordering = ["user__username"]

    def perform_update(self, serializer):
        profile = serializer.save()
        user = profile.user
        user.is_staff = profile.role == UserProfile.Role.ADMIN
        user.is_superuser = profile.role == UserProfile.Role.ADMIN
        user.save(update_fields=["is_staff", "is_superuser"])


class MemberViewSet(RoleScopedModelViewSet):
    queryset = Member.objects.select_related("user").all()
    serializer_class = MemberSerializer
    search_fields = ["membership_number", "full_name", "national_id", "phone_number", "location"]
    ordering_fields = ["membership_number", "full_name", "location", "status", "created_at"]
    exact_filter_fields = ["status", "location"]


class CollectionPointViewSet(RoleScopedModelViewSet):
    queryset = CollectionPoint.objects.all()
    serializer_class = CollectionPointSerializer
    search_fields = ["name", "location"]
    ordering_fields = ["name", "location", "is_active", "created_at"]
    exact_filter_fields = ["is_active", "location"]


class SeasonViewSet(RoleScopedModelViewSet):
    queryset = Season.objects.all()
    serializer_class = SeasonSerializer
    search_fields = ["name"]
    ordering_fields = ["name", "season_type", "start_date", "end_date", "created_at"]
    exact_filter_fields = ["season_type", "is_active", "is_closed"]


class DeliveryViewSet(RoleScopedModelViewSet):
    queryset = Delivery.objects.select_related("member", "season", "collection_point", "recorded_by").all()
    serializer_class = DeliverySerializer
    search_fields = ["member__membership_number", "member__full_name", "collection_point__name", "notes"]
    ordering_fields = ["delivery_date", "weight_kg", "grade", "created_at"]
    exact_filter_fields = ["member", "season", "collection_point", "grade"]

    @transaction.atomic
    def perform_create(self, serializer):
        delivery = serializer.save(recorded_by=self.request.user)
        try:
            sync_delivery_effects(delivery)
        except ValueError as error:
            raise ValidationError({"detail": str(error)})

    @transaction.atomic
    def perform_update(self, serializer):
        current = self.get_object()
        previous = {
            "season": current.season,
            "warehouse": current.collection_point.name,
            "weight_kg": current.weight_kg,
        }
        delivery = serializer.save()
        try:
            sync_delivery_effects(delivery, previous=previous)
        except ValueError as error:
            raise ValidationError({"detail": str(error)})

    @transaction.atomic
    def perform_destroy(self, instance):
        try:
            reverse_delivery_effects(instance)
        except ValueError as error:
            raise ValidationError({"detail": str(error)})
        instance.delete()


class MillingBatchViewSet(RoleScopedModelViewSet):
    queryset = MillingBatch.objects.select_related("season").all()
    serializer_class = MillingBatchSerializer
    search_fields = ["batch_number", "season__name", "notes"]
    ordering_fields = ["batch_number", "milled_on", "cherry_in_kg", "green_bean_out_kg", "created_at"]
    exact_filter_fields = ["season"]

    @transaction.atomic
    def perform_create(self, serializer):
        batch = serializer.save()
        try:
            sync_milling_batch_effects(batch)
        except ValueError as error:
            raise ValidationError({"detail": str(error)})

    @transaction.atomic
    def perform_update(self, serializer):
        current = self.get_object()
        previous = {
            "season": current.season,
            "cherry_in_kg": current.cherry_in_kg,
            "parchment_out_kg": current.parchment_out_kg,
            "green_bean_out_kg": current.green_bean_out_kg,
        }
        batch = serializer.save()
        try:
            sync_milling_batch_effects(batch, previous=previous)
        except ValueError as error:
            raise ValidationError({"detail": str(error)})

    @transaction.atomic
    def perform_destroy(self, instance):
        try:
            reverse_milling_batch_effects(instance)
        except ValueError as error:
            raise ValidationError({"detail": str(error)})
        instance.delete()


class InventoryStockViewSet(RoleScopedModelViewSet):
    queryset = InventoryStock.objects.select_related("season").all()
    serializer_class = InventoryStockSerializer
    search_fields = ["season__name", "warehouse"]
    ordering_fields = ["stock_type", "warehouse", "quantity_kg", "created_at"]
    exact_filter_fields = ["season", "stock_type", "warehouse"]


class LoanViewSet(RoleScopedModelViewSet):
    queryset = Loan.objects.select_related("member", "season", "reviewed_by").all()
    serializer_class = LoanSerializer
    search_fields = ["member__membership_number", "member__full_name", "reason"]
    ordering_fields = ["requested_on", "amount", "status", "created_at"]
    exact_filter_fields = ["member", "season", "status"]

    @transaction.atomic
    def perform_create(self, serializer):
        loan = serializer.save()
        sync_loan_ledger_entry(loan)

    @transaction.atomic
    def perform_update(self, serializer):
        loan = serializer.save()
        sync_loan_ledger_entry(loan)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        if get_user_role(request.user) not in {ADMIN_ROLE, MANAGER_ROLE}:
            raise ValidationError({"detail": "Only admins and managers can approve loans."})
        loan = approve_loan(self.get_object(), request.user)
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        if get_user_role(request.user) not in {ADMIN_ROLE, MANAGER_ROLE}:
            raise ValidationError({"detail": "Only admins and managers can reject loans."})
        loan = reject_loan(self.get_object(), request.user)
        return Response(self.get_serializer(loan).data)


class SaleProceedViewSet(RoleScopedModelViewSet):
    queryset = SaleProceed.objects.select_related("season").all()
    serializer_class = SaleProceedSerializer
    search_fields = ["buyer", "season__name"]
    ordering_fields = ["sold_on", "quantity_kg", "gross_amount", "expenses", "created_at"]
    exact_filter_fields = ["season"]


class PayoutViewSet(RoleScopedModelViewSet):
    queryset = Payout.objects.select_related("member", "season", "generated_by").all()
    serializer_class = PayoutSerializer
    search_fields = ["member__membership_number", "member__full_name", "season__name"]
    ordering_fields = ["delivered_kg", "gross_share", "net_payable", "created_at"]
    exact_filter_fields = ["member", "season"]

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)


class LedgerEntryViewSet(RoleScopedModelViewSet):
    queryset = LedgerEntry.objects.select_related("member", "season").all()
    serializer_class = LedgerEntrySerializer
    search_fields = ["member__membership_number", "member__full_name", "description", "reference"]
    ordering_fields = ["entry_type", "amount", "weight_kg", "created_at"]
    exact_filter_fields = ["member", "season", "entry_type"]


@csrf_exempt
@require_POST
def register(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    user, error_response = create_user_account(payload)
    if error_response:
        return error_response

    response = create_token_pair(user)
    member = getattr(user, "member_profile", None)
    response["user"] = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": get_user_role(user),
        "member": (
            {
                "id": member.id,
                "membership_number": member.membership_number,
                "full_name": member.full_name,
                "national_id": member.national_id,
                "phone_number": member.phone_number,
                "farm_size_acres": str(member.farm_size_acres),
                "location": member.location,
                "status": member.status,
            }
            if member
            else None
        ),
    }
    return JsonResponse(response, status=201)


def social_auth_start(request, provider):
    provider_config = SOCIAL_AUTH_PROVIDERS.get(provider)
    if provider_config is None:
        return JsonResponse({"detail": "Unsupported social login provider."}, status=404)

    client_id = os.environ.get(provider_config["client_id_env"])
    if not client_id:
        return JsonResponse({"detail": f"{provider.title()} OAuth is not configured."}, status=503)

    state = signing.dumps(
        {
            "provider": provider,
            "next": request.GET.get("next") or "/dashboard",
        },
        salt="social-auth",
    )
    params = {
        "client_id": client_id,
        "redirect_uri": oauth_redirect_uri(request, provider),
        "response_type": "code",
        "scope": provider_config["scope"],
        "state": state,
    }
    if provider == "google":
        params["access_type"] = "online"
        params["prompt"] = "select_account"

    return redirect(f"{provider_config['authorize_url']}?{urlencode(params)}")


def social_auth_callback(request, provider):
    provider_config = SOCIAL_AUTH_PROVIDERS.get(provider)
    if provider_config is None:
        return JsonResponse({"detail": "Unsupported social login provider."}, status=404)

    code = request.GET.get("code")
    raw_state = request.GET.get("state")
    if not code or not raw_state:
        return JsonResponse({"detail": "OAuth callback is missing required parameters."}, status=400)

    try:
        state = signing.loads(raw_state, salt="social-auth", max_age=600)
    except signing.BadSignature:
        return JsonResponse({"detail": "Invalid OAuth state."}, status=400)

    if state.get("provider") != provider:
        return JsonResponse({"detail": "OAuth provider mismatch."}, status=400)

    client_id = os.environ.get(provider_config["client_id_env"])
    client_secret = os.environ.get(provider_config["client_secret_env"])
    if not client_id or not client_secret:
        return JsonResponse({"detail": f"{provider.title()} OAuth is not configured."}, status=503)

    try:
        token_response = json_post(
            provider_config["token_url"],
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": oauth_redirect_uri(request, provider),
                "grant_type": "authorization_code",
            },
        )
        access_token = token_response.get("access_token")
        if not access_token:
            return JsonResponse({"detail": "OAuth provider did not return an access token."}, status=400)

        profile = json_get(provider_config["profile_url"], access_token)
    except (URLError, TimeoutError, json.JSONDecodeError):
        return JsonResponse({"detail": "Unable to complete social login."}, status=502)

    user = get_or_create_social_user(provider, profile)
    tokens = create_token_pair(user)
    next_path = state.get("next") or "/dashboard"
    callback_params = urlencode(
        {
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "next": next_path,
        }
    )
    return redirect(f"{frontend_auth_redirect_url()}/#/auth/callback?{callback_params}")


@csrf_exempt
@require_POST
@role_required(ADMIN_ROLE)
def admin_register(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    user, error_response = create_user_account(payload, allow_privileged_roles=True)
    if error_response:
        return error_response

    return JsonResponse(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": get_user_role(user),
        },
        status=201,
    )


@csrf_exempt
@require_POST
def login(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    username = (payload.get("username") or payload.get("email") or "").strip()
    if "@" in username:
        matched_user = get_user_model().objects.filter(email__iexact=username).first()
        if matched_user:
            username = matched_user.username

    user = authenticate(
        request,
        username=username,
        password=payload.get("password"),
    )
    if user is None:
        return JsonResponse({"detail": "Invalid username or password."}, status=401)
    if not user.is_active:
        return JsonResponse({"detail": "This user account is disabled."}, status=403)

    return JsonResponse(create_token_pair(user))


@csrf_exempt
@require_POST
def refresh_access_token(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    refresh_token = get_active_token(payload.get("refresh", ""), AuthToken.TokenType.REFRESH)
    if refresh_token is None:
        return JsonResponse({"detail": "Invalid or expired refresh token."}, status=401)

    return JsonResponse(
        {
            "access": create_token(refresh_token.user, AuthToken.TokenType.ACCESS),
            "token_type": "Bearer",
        }
    )


@csrf_exempt
@require_POST
def logout(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    refresh_token = get_active_token(payload.get("refresh", ""), AuthToken.TokenType.REFRESH)
    if refresh_token:
        refresh_token.revoke()

    return JsonResponse({"detail": "Logged out."})


@role_required(ADMIN_ROLE, MANAGER_ROLE, SECRETARY_ROLE, FIELD_OFFICER_ROLE, MEMBER_ROLE)
def me(request):
    member = getattr(request.user, "member_profile", None)
    return JsonResponse(
        {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "role": get_user_role(request.user),
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
            "member": (
                {
                    "id": member.id,
                    "membership_number": member.membership_number,
                    "full_name": member.full_name,
                    "national_id": member.national_id,
                    "phone_number": member.phone_number,
                    "farm_size_acres": str(member.farm_size_acres),
                    "location": member.location,
                    "status": member.status,
                }
                if member
                else None
            ),
        }
    )


@role_required(ADMIN_ROLE, MANAGER_ROLE, SECRETARY_ROLE, FIELD_OFFICER_ROLE)
def dashboard_summary(request):
    active_season = Season.objects.filter(is_active=True, is_closed=False).first()
    deliveries = Delivery.objects.all()
    loans = Loan.objects.all()

    if active_season:
        deliveries = deliveries.filter(season=active_season)
        loans = loans.filter(season=active_season)

    today = timezone.localdate()
    data = {
        "active_season": active_season.name if active_season else None,
        "members_count": Member.objects.count(),
        "today_cherry_kg": deliveries.filter(delivery_date=today).aggregate(total=Sum("weight_kg"))["total"] or 0,
        "season_cherry_kg": deliveries.aggregate(total=Sum("weight_kg"))["total"] or 0,
        "pending_loans": loans.filter(status=Loan.Status.PENDING).count(),
        "approved_loan_total": loans.filter(status=Loan.Status.APPROVED).aggregate(total=Sum("amount"))["total"] or 0,
        "deliveries_count": deliveries.aggregate(count=Count("id"))["count"],
    }
    return JsonResponse(data)


@role_required(ADMIN_ROLE, MANAGER_ROLE, SECRETARY_ROLE, FIELD_OFFICER_ROLE)
def season_intake_report(request, season_id):
    deliveries = Delivery.objects.filter(season_id=season_id)
    collection_points = (
        deliveries.values("collection_point__name")
        .annotate(total_kg=Sum("weight_kg"), deliveries_count=Count("id"))
        .order_by("-total_kg")
    )
    top_members = (
        deliveries.values("member__membership_number", "member__full_name")
        .annotate(total_kg=Sum("weight_kg"), deliveries_count=Count("id"))
        .order_by("-total_kg")[:10]
    )

    return JsonResponse(
        {
            "season_id": season_id,
            "collection_points": list(collection_points),
            "top_members": list(top_members),
        }
    )


@role_required(ADMIN_ROLE, MANAGER_ROLE, SECRETARY_ROLE, FIELD_OFFICER_ROLE, MEMBER_ROLE)
def collection_points(request):
    points = CollectionPoint.objects.filter(is_active=True).order_by("name")
    return JsonResponse(
        {
            "results": [
                {"id": point.id, "name": point.name, "location": point.location}
                for point in points
            ]
        }
    )


@role_required(ADMIN_ROLE, MANAGER_ROLE, SECRETARY_ROLE, FIELD_OFFICER_ROLE, MEMBER_ROLE)
def payout_statement(request, member_id, season_id):
    member = get_object_or_404(Member, id=member_id)
    if get_user_role(request.user) == MEMBER_ROLE and member.user_id != request.user.id:
        return JsonResponse({"detail": "You do not have permission to view this statement."}, status=403)

    season = get_object_or_404(Season, id=season_id)
    statement = get_payout_statement(member, season)
    serializer = PayoutStatementSerializer(statement)
    return JsonResponse(serializer.data)


@csrf_exempt
@require_POST
@role_required(ADMIN_ROLE, MANAGER_ROLE)
def generate_payouts(request, season_id):
    season = get_object_or_404(Season, id=season_id)
    try:
        payouts = generate_season_payouts(season, request.user)
    except ValueError as error:
        return JsonResponse({"detail": str(error)}, status=400)
    return JsonResponse(
        {
            "season_id": season.id,
            "payouts_generated": len(payouts),
            "total_net_payable": sum(payout.net_payable for payout in payouts),
        }
    )
