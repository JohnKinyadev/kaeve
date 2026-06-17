import json

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.db.models import Count, Sum
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from rest_framework import viewsets

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
    SaleProceedSerializer,
    SeasonSerializer,
)
from .services import generate_season_payouts


def health_check(request):
    return JsonResponse({"status": "ok", "service": "coffee-cooperative-api"})


class RoleScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleBasedApiPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        if get_user_role(self.request.user) != MEMBER_ROLE:
            return queryset

        model_name = queryset.model._meta.model_name
        if model_name == "member":
            return queryset.filter(user=self.request.user)
        if model_name in {"delivery", "loan", "payout", "ledgerentry"}:
            return queryset.filter(member__user=self.request.user)
        return queryset.none()


class MemberViewSet(RoleScopedModelViewSet):
    queryset = Member.objects.select_related("user").all()
    serializer_class = MemberSerializer


class CollectionPointViewSet(RoleScopedModelViewSet):
    queryset = CollectionPoint.objects.all()
    serializer_class = CollectionPointSerializer


class SeasonViewSet(RoleScopedModelViewSet):
    queryset = Season.objects.all()
    serializer_class = SeasonSerializer


class DeliveryViewSet(RoleScopedModelViewSet):
    queryset = Delivery.objects.select_related("member", "season", "collection_point", "recorded_by").all()
    serializer_class = DeliverySerializer


class MillingBatchViewSet(RoleScopedModelViewSet):
    queryset = MillingBatch.objects.select_related("season").all()
    serializer_class = MillingBatchSerializer


class InventoryStockViewSet(RoleScopedModelViewSet):
    queryset = InventoryStock.objects.select_related("season").all()
    serializer_class = InventoryStockSerializer


class LoanViewSet(RoleScopedModelViewSet):
    queryset = Loan.objects.select_related("member", "season", "reviewed_by").all()
    serializer_class = LoanSerializer


class SaleProceedViewSet(RoleScopedModelViewSet):
    queryset = SaleProceed.objects.select_related("season").all()
    serializer_class = SaleProceedSerializer


class PayoutViewSet(RoleScopedModelViewSet):
    queryset = Payout.objects.select_related("member", "season", "generated_by").all()
    serializer_class = PayoutSerializer


class LedgerEntryViewSet(RoleScopedModelViewSet):
    queryset = LedgerEntry.objects.select_related("member", "season").all()
    serializer_class = LedgerEntrySerializer


@csrf_exempt
@require_POST
def register(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not username:
        return JsonResponse({"detail": "Username is required."}, status=400)
    if not password:
        return JsonResponse({"detail": "Password is required."}, status=400)

    user_model = get_user_model()
    if user_model.objects.filter(username=username).exists():
        return JsonResponse({"detail": "Username is already taken."}, status=400)
    if email and user_model.objects.filter(email=email).exists():
        return JsonResponse({"detail": "Email is already taken."}, status=400)

    user = user_model.objects.create_user(
        username=username,
        email=email,
        password=password,
        is_staff=False,
        is_superuser=False,
    )
    user.profile.role = UserProfile.Role.MEMBER
    user.profile.save(update_fields=["role", "updated_at"])

    response = create_token_pair(user)
    response["user"] = {
        "username": user.username,
        "email": user.email,
        "role": get_user_role(user),
    }
    return JsonResponse(response, status=201)


@csrf_exempt
@require_POST
def login(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    user = authenticate(
        request,
        username=payload.get("username"),
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


@role_required(ADMIN_ROLE, MANAGER_ROLE, FIELD_OFFICER_ROLE, MEMBER_ROLE)
def me(request):
    return JsonResponse(
        {
            "username": request.user.username,
            "email": request.user.email,
            "role": get_user_role(request.user),
        }
    )


@role_required(ADMIN_ROLE, MANAGER_ROLE, FIELD_OFFICER_ROLE)
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


@role_required(ADMIN_ROLE, MANAGER_ROLE, FIELD_OFFICER_ROLE)
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


@role_required(ADMIN_ROLE, MANAGER_ROLE, FIELD_OFFICER_ROLE, MEMBER_ROLE)
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


@csrf_exempt
@require_POST
@role_required(ADMIN_ROLE)
def generate_payouts(request, season_id):
    season = Season.objects.get(id=season_id)
    payouts = generate_season_payouts(season, request.user)
    return JsonResponse(
        {
            "season_id": season.id,
            "payouts_generated": len(payouts),
            "total_net_payable": sum(payout.net_payable for payout in payouts),
        }
    )
