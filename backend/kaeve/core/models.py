from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UserProfile(TimeStampedModel):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        FIELD_OFFICER = "field_officer", "Field Officer"
        MEMBER = "member", "Member"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    phone_number = models.CharField(max_length=30, blank=True)

    def __str__(self):
        return f"{self.user} - {self.get_role_display()}"


class AuthToken(TimeStampedModel):
    class TokenType(models.TextChoices):
        ACCESS = "access", "Access"
        REFRESH = "refresh", "Refresh"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    token_type = models.CharField(max_length=20, choices=TokenType.choices)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["token_hash", "token_type"]),
            models.Index(fields=["user", "token_type"]),
        ]

    @property
    def is_active(self):
        return self.revoked_at is None and self.expires_at > timezone.now()

    def revoke(self):
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at", "updated_at"])

    def __str__(self):
        return f"{self.user} - {self.token_type}"


class Member(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        EXITED = "exited", "Exited"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="member_profile",
    )
    membership_number = models.CharField(max_length=30, unique=True)
    full_name = models.CharField(max_length=160)
    national_id = models.CharField(max_length=30, unique=True)
    phone_number = models.CharField(max_length=30, blank=True)
    farm_size_acres = models.DecimalField(max_digits=8, decimal_places=2)
    location = models.CharField(max_length=160)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    def __str__(self):
        return f"{self.membership_number} - {self.full_name}"


class CollectionPoint(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    location = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Season(TimeStampedModel):
    class SeasonType(models.TextChoices):
        MAIN_CROP = "main_crop", "Main Crop"
        FLY_CROP = "fly_crop", "Fly Crop"

    name = models.CharField(max_length=120)
    season_type = models.CharField(max_length=20, choices=SeasonType.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "season_type"],
                name="unique_season_name_and_type",
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F("start_date")),
                name="season_end_date_after_start_date",
            ),
        ]

    def clean(self):
        if self.is_closed and self.is_active:
            raise ValidationError("A closed season cannot also be active.")

    def close(self):
        self.is_active = False
        self.is_closed = True
        self.closed_at = timezone.now()
        self.save(update_fields=["is_active", "is_closed", "closed_at", "updated_at"])

    def __str__(self):
        return f"{self.name} ({self.get_season_type_display()})"


class Delivery(TimeStampedModel):
    class Grade(models.TextChoices):
        GRADE_A = "a", "Grade A"
        GRADE_B = "b", "Grade B"
        PB = "pb", "Peaberry"
        UNGRADED = "ungraded", "Ungraded"

    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="deliveries")
    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="deliveries")
    collection_point = models.ForeignKey(
        CollectionPoint,
        on_delete=models.PROTECT,
        related_name="deliveries",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_deliveries",
    )
    delivery_date = models.DateField(default=timezone.localdate)
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    grade = models.CharField(max_length=20, choices=Grade.choices, default=Grade.UNGRADED)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-delivery_date", "-created_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(weight_kg__gt=0), name="delivery_weight_positive"),
        ]

    def clean(self):
        if self.season_id and self.season.is_closed:
            raise ValidationError("Deliveries cannot be recorded against a closed season.")
        if self.member_id and self.member.status != Member.Status.ACTIVE:
            raise ValidationError("Deliveries can only be recorded for active members.")
        if self.collection_point_id and not self.collection_point.is_active:
            raise ValidationError("Deliveries can only be recorded at active collection points.")

    def __str__(self):
        return f"{self.member} - {self.weight_kg} kg on {self.delivery_date}"


class MillingBatch(TimeStampedModel):
    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="milling_batches")
    batch_number = models.CharField(max_length=40, unique=True)
    cherry_in_kg = models.DecimalField(max_digits=12, decimal_places=2)
    parchment_out_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    green_bean_out_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    milled_on = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)

    @property
    def outturn_ratio(self):
        if not self.cherry_in_kg:
            return 0
        return round((self.green_bean_out_kg / self.cherry_in_kg) * 100, 2)

    def __str__(self):
        return self.batch_number


class InventoryStock(TimeStampedModel):
    class StockType(models.TextChoices):
        CHERRY = "cherry", "Cherry"
        PARCHMENT = "parchment", "Parchment"
        GREEN_BEAN = "green_bean", "Green Bean"

    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="stock_items")
    stock_type = models.CharField(max_length=20, choices=StockType.choices)
    warehouse = models.CharField(max_length=120)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["season", "stock_type", "warehouse"],
                name="unique_stock_per_season_type_warehouse",
            ),
            models.CheckConstraint(condition=models.Q(quantity_kg__gte=0), name="inventory_quantity_not_negative"),
        ]

    def __str__(self):
        return f"{self.get_stock_type_display()} - {self.quantity_kg} kg"


class Loan(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        DEDUCTED = "deducted", "Deducted"

    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="loans")
    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="loans")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    requested_on = models.DateField(default=timezone.localdate)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_loans",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="loan_amount_positive"),
        ]

    def approve(self, reviewed_by):
        self.status = self.Status.APPROVED
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])

    def reject(self, reviewed_by):
        self.status = self.Status.REJECTED
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])

    def __str__(self):
        return f"{self.member} - {self.amount} ({self.status})"


class SaleProceed(TimeStampedModel):
    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="sale_proceeds")
    buyer = models.CharField(max_length=160)
    sold_on = models.DateField(default=timezone.localdate)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2)
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2)
    expenses = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    @property
    def net_amount(self):
        return self.gross_amount - self.expenses

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity_kg__gt=0), name="sale_quantity_positive"),
            models.CheckConstraint(condition=models.Q(gross_amount__gte=0), name="sale_gross_amount_not_negative"),
            models.CheckConstraint(condition=models.Q(expenses__gte=0), name="sale_expenses_not_negative"),
        ]

    def __str__(self):
        return f"{self.buyer} - {self.net_amount}"


class Payout(TimeStampedModel):
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="payouts")
    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="payouts")
    delivered_kg = models.DecimalField(max_digits=12, decimal_places=2)
    gross_share = models.DecimalField(max_digits=14, decimal_places=2)
    loan_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    other_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net_payable = models.DecimalField(max_digits=14, decimal_places=2)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["member", "season"], name="unique_member_season_payout"),
            models.CheckConstraint(condition=models.Q(delivered_kg__gte=0), name="payout_delivered_kg_not_negative"),
            models.CheckConstraint(condition=models.Q(gross_share__gte=0), name="payout_gross_share_not_negative"),
            models.CheckConstraint(condition=models.Q(loan_deductions__gte=0), name="payout_loan_deductions_not_negative"),
            models.CheckConstraint(condition=models.Q(other_deductions__gte=0), name="payout_other_deductions_not_negative"),
        ]

    def __str__(self):
        return f"{self.member} - {self.season} - {self.net_payable}"


class LedgerEntry(TimeStampedModel):
    class EntryType(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        LOAN = "loan", "Loan"
        PAYOUT = "payout", "Payout"
        DEDUCTION = "deduction", "Deduction"

    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="ledger_entries")
    season = models.ForeignKey(Season, on_delete=models.PROTECT, related_name="ledger_entries")
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["member", "season", "entry_type", "reference"],
                name="unique_ledger_reference_per_member_season",
            )
        ]

    def __str__(self):
        return f"{self.member} - {self.entry_type}"
