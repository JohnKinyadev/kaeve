from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    AuthToken,
    CollectionPoint,
    Delivery,
    InventoryStock,
    LedgerEntry,
    Loan,
    LoanPolicy,
    Member,
    MillingBatch,
    Payout,
    SaleProceed,
    Season,
    UserProfile,
)
from .services import (
    MAX_SUPPORTIVE_INTEREST_RATE,
    MIN_SUPPORTIVE_INTEREST_RATE,
    calculate_loan_eligibility,
    get_active_loan_policy,
    member_last_12_month_delivery_kg,
    get_approved_loan_recovery_total,
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


class LoanPolicySerializer(CleanModelSerializer):
    class Meta:
        model = LoanPolicy
        fields = [
            "id",
            "name",
            "is_active",
            "applications_open",
            "advance_rate_per_kg",
            "interest_rate_percent",
            "future_harvest_cap_percent",
            "max_unsecured_guarantor_loan",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


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
    loan_type_display = serializers.CharField(source="get_loan_type_display", read_only=True)
    proof_type_display = serializers.CharField(source="get_proof_type_display", read_only=True)
    collateral_type_display = serializers.CharField(source="get_collateral_type_display", read_only=True)
    guarantor_name = serializers.CharField(source="guarantor.full_name", read_only=True)
    guarantor_membership_number = serializers.CharField(source="guarantor.membership_number", read_only=True)
    last_12_month_delivery_kg = serializers.SerializerMethodField()
    estimated_interest = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    recovery_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "member",
            "member_name",
            "membership_number",
            "season",
            "season_name",
            "loan_type",
            "loan_type_display",
            "proof_type",
            "proof_type_display",
            "collateral_type",
            "collateral_type_display",
            "guarantor",
            "guarantor_name",
            "guarantor_membership_number",
            "amount",
            "eligible_amount",
            "last_12_month_delivery_kg",
            "expected_production_kg",
            "rate_per_kg",
            "savings_amount",
            "interest_rate_percent",
            "term_months",
            "estimated_interest",
            "recovery_amount",
            "reason",
            "guarantor_details",
            "collateral_details",
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
            "loan_type_display",
            "proof_type_display",
            "collateral_type_display",
            "guarantor_name",
            "guarantor_membership_number",
            "eligible_amount",
            "last_12_month_delivery_kg",
            "rate_per_kg",
            "interest_rate_percent",
            "estimated_interest",
            "recovery_amount",
            "status_display",
            "reviewed_by_username",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def get_last_12_month_delivery_kg(self, obj):
        return str(member_last_12_month_delivery_kg(obj.member))

    def validate(self, attrs):
        attrs = super().validate(attrs)
        member = attrs.get("member") or getattr(self.instance, "member", None)
        season = attrs.get("season") or getattr(self.instance, "season", None)
        loan_type = attrs.get("loan_type", getattr(self.instance, "loan_type", Loan.LoanType.CHERRY_ADVANCE))
        proof_type = attrs.get("proof_type", getattr(self.instance, "proof_type", Loan.ProofType.DELIVERY_HISTORY))
        collateral_type = attrs.get(
            "collateral_type",
            getattr(self.instance, "collateral_type", Loan.CollateralType.FUTURE_HARVEST),
        )
        guarantor = attrs.get("guarantor", getattr(self.instance, "guarantor", None))
        savings_amount = attrs.get("savings_amount", getattr(self.instance, "savings_amount", 0))
        expected_production_kg = attrs.get(
            "expected_production_kg",
            getattr(self.instance, "expected_production_kg", 0),
        )
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        policy = get_active_loan_policy()

        if not policy.applications_open:
            raise serializers.ValidationError({"detail": "Loan applications are currently closed."})

        attrs["rate_per_kg"] = policy.advance_rate_per_kg
        attrs["interest_rate_percent"] = policy.interest_rate_percent

        if policy.interest_rate_percent < MIN_SUPPORTIVE_INTEREST_RATE or policy.interest_rate_percent > MAX_SUPPORTIVE_INTEREST_RATE:
            raise serializers.ValidationError(
                {
                    "interest_rate_percent": (
                        f"Configured interest rate must be between {MIN_SUPPORTIVE_INTEREST_RATE}% "
                        f"and {MAX_SUPPORTIVE_INTEREST_RATE}%."
                    )
                }
            )

        if collateral_type == Loan.CollateralType.FUTURE_HARVEST:
            last_12_month_kg = member_last_12_month_delivery_kg(member) if member else Decimal("0")
            if last_12_month_kg <= 0:
                raise serializers.ValidationError(
                    {"collateral_type": "Future harvest loans require delivery history in the last 12 months."}
                )
            attrs["guarantor"] = None
            attrs["savings_amount"] = Decimal("0.00")
            attrs["collateral_details"] = (
                attrs.get("collateral_details")
                or "Crop lien on future coffee harvest and automatic recovery from payout."
            )
        else:
            if guarantor is None:
                raise serializers.ValidationError({"guarantor": "Select an existing cooperative member as guarantor."})
            if member and guarantor.id == member.id:
                raise serializers.ValidationError({"guarantor": "A member cannot guarantee their own loan."})
            if Decimal(savings_amount or 0) <= 0:
                raise serializers.ValidationError({"savings_amount": "Savings amount is required for guarantor loans."})
            attrs["guarantor_details"] = (
                attrs.get("guarantor_details")
                or f"{guarantor.membership_number} - {guarantor.full_name}"
            )

        if member and season:
            eligible_amount = calculate_loan_eligibility(
                member=member,
                season=season,
                loan_type=loan_type,
                proof_type=proof_type,
                expected_production_kg=expected_production_kg,
                rate_per_kg=policy.advance_rate_per_kg,
                savings_amount=savings_amount,
                collateral_type=collateral_type,
                policy=policy,
            )
            attrs["eligible_amount"] = eligible_amount
            if amount is not None and Decimal(amount) > eligible_amount:
                raise serializers.ValidationError(
                    {"amount": f"Requested amount exceeds eligible limit of Ksh {eligible_amount}."}
                )

        return attrs


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
        return get_approved_loan_recovery_total(member.id, season)

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
