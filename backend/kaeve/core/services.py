from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Delivery, InventoryStock, LedgerEntry, Loan, LoanPolicy, LoanRepayment, Payout, SaleProceed


MONEY_PLACES = Decimal("0.01")
DEFAULT_CHERRY_ADVANCE_RATE = Decimal("50.00")
MIN_CHERRY_ADVANCE_RATE = Decimal("40.00")
MAX_CHERRY_ADVANCE_RATE = Decimal("60.00")
MAX_UNSECURED_SACCO_LOAN = Decimal("1000000.00")
MIN_SUPPORTIVE_INTEREST_RATE = Decimal("5.00")
MAX_SUPPORTIVE_INTEREST_RATE = Decimal("7.50")
ESTIMATED_KG_PER_ACRE = Decimal("500.00")


def money(value):
    return Decimal(value or 0).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def get_active_loan_policy():
    policy = LoanPolicy.objects.filter(is_active=True).order_by("-updated_at", "-id").first()
    if policy:
        return policy
    return LoanPolicy.objects.create()


def member_delivery_kg(member, season=None, since=None):
    deliveries = Delivery.objects.filter(member=member)
    if season:
        deliveries = deliveries.filter(season=season)
    if since:
        deliveries = deliveries.filter(delivery_date__gte=since)
    return deliveries.aggregate(total=Sum("weight_kg"))["total"] or Decimal("0")


def member_last_12_month_delivery_kg(member):
    return member_delivery_kg(member, since=timezone.localdate() - timezone.timedelta(days=365))


def clamp_interest_rate(rate):
    rate = Decimal(rate or MIN_SUPPORTIVE_INTEREST_RATE)
    return min(max(rate, MIN_SUPPORTIVE_INTEREST_RATE), MAX_SUPPORTIVE_INTEREST_RATE)


def clamp_cherry_rate(rate):
    rate = Decimal(rate or DEFAULT_CHERRY_ADVANCE_RATE)
    return min(max(rate, MIN_CHERRY_ADVANCE_RATE), MAX_CHERRY_ADVANCE_RATE)


def calculate_loan_eligibility(
    member,
    season,
    loan_type,
    proof_type,
    expected_production_kg=0,
    rate_per_kg=0,
    savings_amount=0,
    collateral_type=Loan.CollateralType.FUTURE_HARVEST,
    policy=None,
):
    policy = policy or get_active_loan_policy()
    expected_production_kg = Decimal(expected_production_kg or 0)
    savings_amount = Decimal(savings_amount or 0)
    rate_per_kg = Decimal(rate_per_kg or policy.advance_rate_per_kg)

    if collateral_type == Loan.CollateralType.FUTURE_HARVEST:
        last_12_month_kg = member_last_12_month_delivery_kg(member)
        if last_12_month_kg <= 0:
            return Decimal("0.00")
        harvest_value = last_12_month_kg * rate_per_kg
        return money(harvest_value * (Decimal(policy.future_harvest_cap_percent or 0) / Decimal("100")))

    return money(min(savings_amount * Decimal("3"), Decimal(policy.max_unsecured_guarantor_loan or 0)))


def get_season_total_delivery_kg(season):
    return Delivery.objects.filter(season=season).aggregate(total=Sum("weight_kg"))["total"] or Decimal("0")


def get_season_net_proceeds(season):
    sales = SaleProceed.objects.filter(season=season)
    gross = sales.aggregate(total=Sum("gross_amount"))["total"] or Decimal("0")
    expenses = sales.aggregate(total=Sum("expenses"))["total"] or Decimal("0")
    return gross - expenses


def get_approved_loan_recovery_total(member_id, season):
    loans = Loan.objects.filter(
        member_id=member_id,
        season=season,
        status__in=[Loan.Status.APPROVED, Loan.Status.DEDUCTED],
    )
    return money(sum((get_loan_outstanding_amount(loan) for loan in loans), Decimal("0")))


def get_loan_repayment_total(loan):
    return money(LoanRepayment.objects.filter(loan=loan).aggregate(total=Sum("amount"))["total"] or Decimal("0"))


def get_loan_outstanding_amount(loan):
    return money(max(loan.recovery_amount - get_loan_repayment_total(loan), Decimal("0")))


def update_inventory_quantity(season, stock_type, warehouse, delta_kg):
    delta_kg = Decimal(delta_kg or 0)
    if delta_kg == 0:
        return None

    stock = InventoryStock.objects.filter(
        season=season,
        stock_type=stock_type,
        warehouse=warehouse,
    ).order_by("id").first()
    if stock is None:
        stock = InventoryStock.objects.create(
            season=season,
            stock_type=stock_type,
            warehouse=warehouse,
            quantity_kg=Decimal("0.00"),
        )
    next_quantity = stock.quantity_kg + delta_kg
    if next_quantity < 0:
        raise ValueError(
            f"Inventory for {stock.get_stock_type_display()} in {warehouse} cannot go below zero."
        )
    stock.quantity_kg = next_quantity
    stock.save(update_fields=["quantity_kg", "updated_at"])
    return stock


def get_inventory_quantity(season, stock_type):
    return InventoryStock.objects.filter(
        season=season,
        stock_type=stock_type,
    ).aggregate(total=Sum("quantity_kg"))["total"] or Decimal("0.00")


def consume_inventory_quantity(season, stock_type, quantity_kg, preferred_warehouse="Milling"):
    quantity_kg = Decimal(quantity_kg or 0)
    if quantity_kg <= 0:
        return

    available_kg = get_inventory_quantity(season, stock_type)
    if quantity_kg > available_kg:
        raise ValueError(
            f"Only {available_kg} kg of {InventoryStock.StockType(stock_type).label} is available for milling."
        )

    remaining_kg = quantity_kg
    stocks = list(
        InventoryStock.objects.select_for_update()
        .filter(season=season, stock_type=stock_type, quantity_kg__gt=0)
        .order_by("warehouse", "id")
    )
    stocks.sort(key=lambda stock: (stock.warehouse != preferred_warehouse, stock.warehouse, stock.id))

    for stock in stocks:
        if remaining_kg <= 0:
            break
        used_kg = min(stock.quantity_kg, remaining_kg)
        stock.quantity_kg = stock.quantity_kg - used_kg
        stock.save(update_fields=["quantity_kg", "updated_at"])
        remaining_kg -= used_kg


def sync_delivery_effects(delivery, previous=None):
    if previous:
        update_inventory_quantity(
            previous["season"],
            InventoryStock.StockType.CHERRY,
            previous["warehouse"],
            -previous["weight_kg"],
        )

    update_inventory_quantity(
        delivery.season,
        InventoryStock.StockType.CHERRY,
        delivery.collection_point.name,
        delivery.weight_kg,
    )
    ledger_defaults = {
        "description": f"Cherry delivery at {delivery.collection_point.name}",
        "amount": Decimal("0.00"),
        "weight_kg": delivery.weight_kg,
    }
    ledger = LedgerEntry.objects.filter(
        member=delivery.member,
        season=delivery.season,
        entry_type=LedgerEntry.EntryType.DELIVERY,
        reference=f"delivery:{delivery.id}",
    ).order_by("id").first()
    if ledger:
        for field, value in ledger_defaults.items():
            setattr(ledger, field, value)
        ledger.save(update_fields=[*ledger_defaults.keys(), "updated_at"])
    else:
        LedgerEntry.objects.create(
            member=delivery.member,
            season=delivery.season,
            entry_type=LedgerEntry.EntryType.DELIVERY,
            reference=f"delivery:{delivery.id}",
            **ledger_defaults,
        )


def reverse_delivery_effects(delivery):
    update_inventory_quantity(
        delivery.season,
        InventoryStock.StockType.CHERRY,
        delivery.collection_point.name,
        -delivery.weight_kg,
    )
    LedgerEntry.objects.filter(
        member=delivery.member,
        season=delivery.season,
        entry_type=LedgerEntry.EntryType.DELIVERY,
        reference=f"delivery:{delivery.id}",
    ).delete()


def sync_milling_batch_effects(batch, previous=None):
    warehouse = "Milling"
    if previous:
        update_inventory_quantity(previous["season"], InventoryStock.StockType.CHERRY, warehouse, previous["cherry_in_kg"])
        update_inventory_quantity(
            previous["season"],
            InventoryStock.StockType.PARCHMENT,
            warehouse,
            -previous["parchment_out_kg"],
        )
        update_inventory_quantity(
            previous["season"],
            InventoryStock.StockType.GREEN_BEAN,
            warehouse,
            -previous["green_bean_out_kg"],
        )

    consume_inventory_quantity(batch.season, InventoryStock.StockType.CHERRY, batch.cherry_in_kg, warehouse)
    update_inventory_quantity(batch.season, InventoryStock.StockType.PARCHMENT, warehouse, batch.parchment_out_kg)
    update_inventory_quantity(batch.season, InventoryStock.StockType.GREEN_BEAN, warehouse, batch.green_bean_out_kg)


def reverse_milling_batch_effects(batch):
    warehouse = "Milling"
    update_inventory_quantity(batch.season, InventoryStock.StockType.CHERRY, warehouse, batch.cherry_in_kg)
    update_inventory_quantity(batch.season, InventoryStock.StockType.PARCHMENT, warehouse, -batch.parchment_out_kg)
    update_inventory_quantity(batch.season, InventoryStock.StockType.GREEN_BEAN, warehouse, -batch.green_bean_out_kg)


def sync_loan_ledger_entry(loan):
    ledger_defaults = {
        "description": f"Loan {loan.get_status_display().lower()}: {loan.reason or 'No reason provided'}",
        "amount": loan.amount,
        "weight_kg": None,
    }
    ledger = LedgerEntry.objects.filter(
        member=loan.member,
        season=loan.season,
        entry_type=LedgerEntry.EntryType.LOAN,
        reference=f"loan:{loan.id}",
    ).order_by("id").first()
    if ledger:
        for field, value in ledger_defaults.items():
            setattr(ledger, field, value)
        ledger.save(update_fields=[*ledger_defaults.keys(), "updated_at"])
    else:
        LedgerEntry.objects.create(
            member=loan.member,
            season=loan.season,
            entry_type=LedgerEntry.EntryType.LOAN,
            reference=f"loan:{loan.id}",
            **ledger_defaults,
        )


@transaction.atomic
def approve_loan(loan, reviewed_by):
    loan.approve(reviewed_by)
    sync_loan_ledger_entry(loan)
    return loan


@transaction.atomic
def reject_loan(loan, reviewed_by):
    loan.reject(reviewed_by)
    sync_loan_ledger_entry(loan)
    return loan


def get_payout_statement(member, season):
    deliveries = Delivery.objects.filter(member=member, season=season)
    loans = Loan.objects.filter(member=member, season=season)
    ledger_entries = LedgerEntry.objects.filter(member=member, season=season).order_by("-created_at")
    payout = Payout.objects.filter(member=member, season=season).first()

    return {
        "member": {
            "id": member.id,
            "membership_number": member.membership_number,
            "full_name": member.full_name,
        },
        "season": {
            "id": season.id,
            "name": season.name,
            "season_type": season.season_type,
        },
        "totals": {
            "delivered_kg": deliveries.aggregate(total=Sum("weight_kg"))["total"] or Decimal("0.00"),
            "approved_loans": get_approved_loan_recovery_total(member.id, season),
            "net_payable": payout.net_payable if payout else Decimal("0.00"),
        },
        "payout": payout,
        "deliveries": deliveries.order_by("-delivery_date", "-created_at"),
        "loans": loans.order_by("-requested_on", "-created_at"),
        "ledger_entries": ledger_entries,
    }


@transaction.atomic
def generate_season_payouts(season, generated_by):
    payout_rate = Decimal(season.payout_rate_per_kg or 0)

    if payout_rate <= 0:
        raise ValueError("Set this season's payout rate per kg before generating payouts.")

    member_deliveries = (
        Delivery.objects.filter(season=season)
        .values("member")
        .annotate(delivered_kg=Sum("weight_kg"))
        .order_by("member")
    )

    payouts = []
    for row in member_deliveries:
        member_id = row["member"]
        delivered_kg = row["delivered_kg"] or Decimal("0")
        gross_share = money(delivered_kg * payout_rate)
        loan_deductions = get_approved_loan_recovery_total(member_id, season)
        net_payable = money(gross_share - loan_deductions)

        payout_defaults = {
            "delivered_kg": delivered_kg,
            "gross_share": gross_share,
            "loan_deductions": money(loan_deductions),
            "other_deductions": Decimal("0.00"),
            "net_payable": net_payable,
            "generated_by": generated_by,
        }
        payout = Payout.objects.filter(
            member_id=member_id,
            season=season,
        ).order_by("id").first()
        if payout:
            for field, value in payout_defaults.items():
                setattr(payout, field, value)
            payout.save(update_fields=[*payout_defaults.keys(), "updated_at"])
        else:
            payout = Payout.objects.create(member_id=member_id, season=season, **payout_defaults)

        ledger_defaults = {
            "description": f"Payout generated for {season}",
            "amount": net_payable,
            "weight_kg": delivered_kg,
        }
        ledger = LedgerEntry.objects.filter(
            member_id=member_id,
            season=season,
            entry_type=LedgerEntry.EntryType.PAYOUT,
            reference=f"payout:{payout.id}",
        ).order_by("id").first()
        if ledger:
            for field, value in ledger_defaults.items():
                setattr(ledger, field, value)
            ledger.save(update_fields=[*ledger_defaults.keys(), "updated_at"])
        else:
            LedgerEntry.objects.create(
                member_id=member_id,
                season=season,
                entry_type=LedgerEntry.EntryType.PAYOUT,
                reference=f"payout:{payout.id}",
                **ledger_defaults,
            )

        Loan.objects.filter(
            member_id=member_id,
            season=season,
            status=Loan.Status.APPROVED,
        ).update(status=Loan.Status.DEDUCTED)

        payouts.append(payout)

    return payouts
