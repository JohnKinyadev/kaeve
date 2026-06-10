from django.contrib import admin

from .permissions import RoleBasedAdminMixin
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


@admin.register(AuthToken)
class AuthTokenAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("user", "token_type", "expires_at", "revoked_at", "created_at")
    list_filter = ("token_type", "revoked_at", "expires_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("token_hash", "created_at", "updated_at")


@admin.register(UserProfile)
class UserProfileAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("user", "role", "phone_number")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email", "phone_number")


@admin.register(Member)
class MemberAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("membership_number", "full_name", "national_id", "location", "status")
    list_filter = ("status", "location")
    search_fields = ("membership_number", "full_name", "national_id", "phone_number")


@admin.register(Season)
class SeasonAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("name", "season_type", "start_date", "end_date", "is_active", "is_closed")
    list_filter = ("season_type", "is_active", "is_closed")


@admin.register(CollectionPoint)
class CollectionPointAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("name", "location", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "location")


@admin.register(Delivery)
class DeliveryAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("member", "season", "collection_point", "delivery_date", "weight_kg", "grade")
    list_filter = ("season", "collection_point", "grade", "delivery_date")
    search_fields = ("member__full_name", "member__membership_number")


@admin.register(MillingBatch)
class MillingBatchAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    pass


@admin.register(InventoryStock)
class InventoryStockAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    pass


@admin.register(Loan)
class LoanAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    list_display = ("member", "season", "amount", "status", "requested_on", "reviewed_by")
    list_filter = ("season", "status", "requested_on")
    search_fields = ("member__full_name", "member__membership_number")


@admin.register(SaleProceed)
class SaleProceedAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    pass


@admin.register(Payout)
class PayoutAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    pass


@admin.register(LedgerEntry)
class LedgerEntryAdmin(RoleBasedAdminMixin, admin.ModelAdmin):
    pass
