from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import CollectionPoint, Delivery, Loan, Member, SaleProceed, Season
from .services import generate_season_payouts


class PayoutServiceTests(TestCase):
    def test_generates_proportional_payouts_with_loan_deductions(self):
        user = get_user_model().objects.create_user(username="manager", password="password")
        recorder = get_user_model().objects.create_user(username="field", password="password")
        season = Season.objects.create(
            name="Main Crop 2026",
            season_type=Season.SeasonType.MAIN_CROP,
            start_date=timezone.localdate(),
        )
        point = CollectionPoint.objects.create(name="Kiamumbi", location="Kiambu")
        member_one = Member.objects.create(
            membership_number="KC001",
            full_name="Jane Wanjiku",
            national_id="12345678",
            farm_size_acres=Decimal("2.50"),
            location="Kiambu",
        )
        member_two = Member.objects.create(
            membership_number="KC002",
            full_name="Peter Mwangi",
            national_id="23456789",
            farm_size_acres=Decimal("1.75"),
            location="Kiambu",
        )

        Delivery.objects.create(
            member=member_one,
            season=season,
            collection_point=point,
            recorded_by=recorder,
            weight_kg=Decimal("75.00"),
        )
        Delivery.objects.create(
            member=member_two,
            season=season,
            collection_point=point,
            recorded_by=recorder,
            weight_kg=Decimal("25.00"),
        )
        Loan.objects.create(
            member=member_one,
            season=season,
            amount=Decimal("1000.00"),
            status=Loan.Status.APPROVED,
        )
        SaleProceed.objects.create(
            season=season,
            buyer="Auction Buyer",
            quantity_kg=Decimal("100.00"),
            gross_amount=Decimal("10000.00"),
            expenses=Decimal("1000.00"),
        )

        payouts = generate_season_payouts(season, user)

        self.assertEqual(len(payouts), 2)
        self.assertEqual(member_one.payouts.get(season=season).net_payable, Decimal("5750.00"))
        self.assertEqual(member_two.payouts.get(season=season).net_payable, Decimal("2250.00"))
