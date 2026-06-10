from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum

from .models import Delivery, LedgerEntry, Loan, Payout, SaleProceed


MONEY_PLACES = Decimal("0.01")


def money(value):
    return Decimal(value or 0).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def get_season_total_delivery_kg(season):
    return Delivery.objects.filter(season=season).aggregate(total=Sum("weight_kg"))["total"] or Decimal("0")


def get_season_net_proceeds(season):
    sales = SaleProceed.objects.filter(season=season)
    gross = sales.aggregate(total=Sum("gross_amount"))["total"] or Decimal("0")
    expenses = sales.aggregate(total=Sum("expenses"))["total"] or Decimal("0")
    return gross - expenses


@transaction.atomic
def generate_season_payouts(season, generated_by):
    total_kg = get_season_total_delivery_kg(season)
    net_proceeds = get_season_net_proceeds(season)

    if total_kg <= 0:
        raise ValueError("Cannot generate payouts for a season with no deliveries.")
    if net_proceeds < 0:
        raise ValueError("Cannot generate payouts when season net proceeds are negative.")

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
        gross_share = money((delivered_kg / total_kg) * net_proceeds)
        loan_deductions = (
            Loan.objects.filter(
                member_id=member_id,
                season=season,
                status__in=[Loan.Status.APPROVED, Loan.Status.DEDUCTED],
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        net_payable = money(gross_share - loan_deductions)

        payout, _ = Payout.objects.update_or_create(
            member_id=member_id,
            season=season,
            defaults={
                "delivered_kg": delivered_kg,
                "gross_share": gross_share,
                "loan_deductions": money(loan_deductions),
                "other_deductions": Decimal("0.00"),
                "net_payable": net_payable,
                "generated_by": generated_by,
            },
        )

        LedgerEntry.objects.update_or_create(
            member_id=member_id,
            season=season,
            entry_type=LedgerEntry.EntryType.PAYOUT,
            reference=f"payout:{payout.id}",
            defaults={
                "description": f"Payout generated for {season}",
                "amount": net_payable,
                "weight_kg": delivered_kg,
            },
        )

        Loan.objects.filter(
            member_id=member_id,
            season=season,
            status=Loan.Status.APPROVED,
        ).update(status=Loan.Status.DEDUCTED)

        payouts.append(payout)

    return payouts
