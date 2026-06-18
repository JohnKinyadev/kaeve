from django.contrib.auth import get_user_model
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
    username = serializers.CharField(source="user.username", read_only=True)

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "username", "created_at", "updated_at"]


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
    outturn_ratio = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

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
            "generated_by_username",
            "created_at",
            "updated_at",
        ]


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
