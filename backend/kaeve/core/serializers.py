from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

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


class CleanModelSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance or self.Meta.model()

        for field, value in attrs.items():
            setattr(instance, field, value)

        instance.clean()
        return attrs


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    phone_number = serializers.CharField(source="profile.phone_number", read_only=True)

    class Meta:
        model = get_user_model()
        fields = ["id", "username", "email", "first_name", "last_name", "role", "phone_number"]
        read_only_fields = ["id", "role", "phone_number"]


class UserProfileSerializer(CleanModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "user",
            "username",
            "email",
            "role",
            "phone_number",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "username", "email", "created_at", "updated_at"]


class AuthTokenSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = AuthToken
        fields = [
            "id",
            "user",
            "username",
            "token_type",
            "expires_at",
            "revoked_at",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "username", "is_active", "created_at", "updated_at"]


class MemberSerializer(CleanModelSerializer):
    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, style={"input_type": "password"})

    class Meta:
        model = Member
        fields = [
            "id",
            "user",
            "username",
            "membership_number",
            "full_name",
            "national_id",
            "phone_number",
            "farm_size_acres",
            "location",
            "status",
            "email",
            "password",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["username"] = instance.user.username if instance.user_id else ""
        return data

    def validate(self, attrs):
        attrs = super().validate(attrs)
        username = (attrs.get("username") or "").strip()
        email = (attrs.get("email") or "").strip()
        password = attrs.get("password") or ""
        user = attrs.get("user")
        user_model = get_user_model()
        current_user_id = getattr(getattr(self.instance, "user", None), "id", None)
        has_account = bool(user or current_user_id)
        wants_account_change = bool(username or email or password)

        if wants_account_change and not has_account and (not username or not password):
            raise serializers.ValidationError(
                {"username": "Username and password are required to create a member login."}
            )
        if username and not password and not has_account:
            raise serializers.ValidationError({"password": "Password is required when creating a member login."})
        if password and not username and not has_account:
            raise serializers.ValidationError({"username": "Username is required when creating a member login."})
        if username and user_model.objects.filter(username=username).exclude(id=current_user_id).exists():
            raise serializers.ValidationError({"username": "Username is already taken."})
        if email and user_model.objects.filter(email=email).exclude(id=current_user_id).exists():
            raise serializers.ValidationError({"email": "Email is already taken."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        username = (validated_data.pop("username", "") or "").strip()
        email = (validated_data.pop("email", "") or "").strip()
        password = validated_data.pop("password", "") or ""
        user = validated_data.get("user")

        if username and password and user is None:
            user = get_user_model().objects.create_user(
                username=username,
                email=email,
                password=password,
            )
            user.profile.role = UserProfile.Role.MEMBER
            user.profile.phone_number = validated_data.get("phone_number", "")
            user.profile.save(update_fields=["role", "phone_number", "updated_at"])
            validated_data["user"] = user

        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        username = (validated_data.pop("username", "") or "").strip()
        email = (validated_data.pop("email", "") or "").strip()
        password = validated_data.pop("password", "") or ""

        member = super().update(instance, validated_data)
        if not any([username, email, password]):
            return member

        user = member.user
        if user is None:
            if not username or not password:
                raise serializers.ValidationError(
                    {"username": "Username and password are required to create a login for this member."}
                )
            user = get_user_model().objects.create_user(username=username, email=email, password=password)
            member.user = user
            member.save(update_fields=["user", "updated_at"])
        else:
            if username:
                user.username = username
            if email:
                user.email = email
            if password:
                user.set_password(password)
            user.save()

        user.profile.role = UserProfile.Role.MEMBER
        user.profile.phone_number = member.phone_number
        user.profile.save(update_fields=["role", "phone_number", "updated_at"])
        return member


class CollectionPointSerializer(CleanModelSerializer):
    class Meta:
        model = CollectionPoint
        fields = ["id", "name", "location", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class SeasonSerializer(CleanModelSerializer):
    season_type_display = serializers.CharField(source="get_season_type_display", read_only=True)

    class Meta:
        model = Season
        fields = [
            "id",
            "name",
            "season_type",
            "season_type_display",
            "start_date",
            "end_date",
            "is_active",
            "is_closed",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "season_type_display", "closed_at", "created_at", "updated_at"]


class DeliverySerializer(CleanModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    membership_number = serializers.CharField(source="member.membership_number", read_only=True)
    season_name = serializers.CharField(source="season.name", read_only=True)
    collection_point_name = serializers.CharField(source="collection_point.name", read_only=True)
    recorded_by_username = serializers.CharField(source="recorded_by.username", read_only=True)
    grade_display = serializers.CharField(source="get_grade_display", read_only=True)

    class Meta:
        model = Delivery
        fields = [
            "id",
            "member",
            "member_name",
            "membership_number",
            "season",
            "season_name",
            "collection_point",
            "collection_point_name",
            "recorded_by",
            "recorded_by_username",
            "delivery_date",
            "weight_kg",
            "grade",
            "grade_display",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "member_name",
            "membership_number",
            "season_name",
            "collection_point_name",
            "recorded_by",
            "recorded_by_username",
            "grade_display",
            "created_at",
            "updated_at",
        ]


class MillingBatchSerializer(CleanModelSerializer):
    season_name = serializers.CharField(source="season.name", read_only=True)
    outturn_ratio = serializers.DecimalField(max_digits=7, decimal_places=2, read_only=True)

    class Meta:
        model = MillingBatch
        fields = [
            "id",
            "season",
            "season_name",
            "batch_number",
            "cherry_in_kg",
            "parchment_out_kg",
            "green_bean_out_kg",
            "outturn_ratio",
            "milled_on",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "season_name", "outturn_ratio", "created_at", "updated_at"]


class InventoryStockSerializer(CleanModelSerializer):
    season_name = serializers.CharField(source="season.name", read_only=True)
    stock_type_display = serializers.CharField(source="get_stock_type_display", read_only=True)

    class Meta:
        model = InventoryStock
        fields = [
            "id",
            "season",
            "season_name",
            "stock_type",
            "stock_type_display",
            "warehouse",
            "quantity_kg",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "season_name", "stock_type_display", "created_at", "updated_at"]


class LoanSerializer(CleanModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    membership_number = serializers.CharField(source="member.membership_number", read_only=True)
    season_name = serializers.CharField(source="season.name", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "member",
            "member_name",
            "membership_number",
            "season",
            "season_name",
            "amount",
            "reason",
            "status",
            "status_display",
            "requested_on",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "member_name",
            "membership_number",
            "season_name",
            "status_display",
            "reviewed_by_username",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]


class SaleProceedSerializer(CleanModelSerializer):
    season_name = serializers.CharField(source="season.name", read_only=True)
    net_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = SaleProceed
        fields = [
            "id",
            "season",
            "season_name",
            "buyer",
            "sold_on",
            "quantity_kg",
            "gross_amount",
            "expenses",
            "net_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "season_name", "net_amount", "created_at", "updated_at"]


class PayoutSerializer(CleanModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    membership_number = serializers.CharField(source="member.membership_number", read_only=True)
    season_name = serializers.CharField(source="season.name", read_only=True)
    generated_by_username = serializers.CharField(source="generated_by.username", read_only=True)

    class Meta:
        model = Payout
        fields = [
            "id",
            "member",
            "member_name",
            "membership_number",
            "season",
            "season_name",
            "delivered_kg",
            "gross_share",
            "loan_deductions",
            "other_deductions",
            "net_payable",
            "generated_by",
            "generated_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "member_name",
            "membership_number",
            "season_name",
            "loan_deductions",
            "net_payable",
            "generated_by",
            "generated_by_username",
            "created_at",
            "updated_at",
        ]

    def _approved_loan_total(self, member, season):
        return (
            Loan.objects.filter(
                member=member,
                season=season,
                status__in=[Loan.Status.APPROVED, Loan.Status.DEDUCTED],
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        member = attrs.get("member") or getattr(self.instance, "member", None)
        season = attrs.get("season") or getattr(self.instance, "season", None)
        gross_share = attrs.get("gross_share", getattr(self.instance, "gross_share", Decimal("0.00")))
        other_deductions = attrs.get(
            "other_deductions",
            getattr(self.instance, "other_deductions", Decimal("0.00")),
        )

        if member and season:
            loan_deductions = self._approved_loan_total(member, season)
            attrs["loan_deductions"] = loan_deductions
            attrs["net_payable"] = Decimal(gross_share or 0) - Decimal(loan_deductions or 0) - Decimal(
                other_deductions or 0
            )
        return attrs


class LedgerEntrySerializer(CleanModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    membership_number = serializers.CharField(source="member.membership_number", read_only=True)
    season_name = serializers.CharField(source="season.name", read_only=True)
    entry_type_display = serializers.CharField(source="get_entry_type_display", read_only=True)

    class Meta:
        model = LedgerEntry
        fields = [
            "id",
            "member",
            "member_name",
            "membership_number",
            "season",
            "season_name",
            "entry_type",
            "entry_type_display",
            "description",
            "amount",
            "weight_kg",
            "reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "member_name",
            "membership_number",
            "season_name",
            "entry_type_display",
            "created_at",
            "updated_at",
        ]


class PayoutStatementSerializer(serializers.Serializer):
    member = serializers.DictField(read_only=True)
    season = serializers.DictField(read_only=True)
    totals = serializers.DictField(read_only=True)
    payout = PayoutSerializer(read_only=True)
    deliveries = DeliverySerializer(many=True, read_only=True)
    loans = LoanSerializer(many=True, read_only=True)
    ledger_entries = LedgerEntrySerializer(many=True, read_only=True)
