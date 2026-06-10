import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import AuthToken, CollectionPoint, Delivery, Loan, Member, SaleProceed, Season, UserProfile
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


class RoleProtectedApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin_user = get_user_model().objects.create_user(username="manager", password="password")
        self.admin_user.profile.role = UserProfile.Role.ADMIN
        self.admin_user.profile.save()
        self.field_user = get_user_model().objects.create_user(username="field", password="password")
        self.field_user.profile.role = UserProfile.Role.FIELD_OFFICER
        self.field_user.profile.save()
        self.member_user = get_user_model().objects.create_user(username="member", password="password")

    def test_dashboard_requires_authentication(self):
        response = self.client.get("/api/dashboard-summary/")

        self.assertEqual(response.status_code, 401)

    def test_dashboard_rejects_member_role(self):
        self.client.login(username="member", password="password")

        response = self.client.get("/api/dashboard-summary/")

        self.assertEqual(response.status_code, 403)

    def test_dashboard_allows_field_officer_role(self):
        self.client.login(username="field", password="password")

        response = self.client.get("/api/dashboard-summary/")

        self.assertEqual(response.status_code, 200)

    def test_generate_payouts_requires_admin_role(self):
        season = Season.objects.create(
            name="Main Crop 2026",
            season_type=Season.SeasonType.MAIN_CROP,
            start_date=timezone.localdate(),
        )
        self.client.login(username="field", password="password")

        response = self.client.post(f"/api/seasons/{season.id}/generate-payouts/")

        self.assertEqual(response.status_code, 403)


class TokenAuthTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = get_user_model().objects.create_user(username="manager", password="password")
        self.user.profile.role = UserProfile.Role.ADMIN
        self.user.profile.save()

    def test_login_returns_access_and_refresh_tokens(self):
        response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager", "password": "password"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())

    def test_access_token_can_call_role_protected_api(self):
        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager", "password": "password"}),
            content_type="application/json",
        )
        access_token = login_response.json()["access"]

        response = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], UserProfile.Role.ADMIN)

    def test_refresh_token_creates_new_access_token(self):
        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager", "password": "password"}),
            content_type="application/json",
        )

        response = self.client.post(
            "/api/auth/refresh/",
            json.dumps({"refresh": login_response.json()["refresh"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_logout_revokes_refresh_token(self):
        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager", "password": "password"}),
            content_type="application/json",
        )
        refresh_token = login_response.json()["refresh"]

        logout_response = self.client.post(
            "/api/auth/logout/",
            json.dumps({"refresh": refresh_token}),
            content_type="application/json",
        )
        refresh_response = self.client.post(
            "/api/auth/refresh/",
            json.dumps({"refresh": refresh_token}),
            content_type="application/json",
        )

        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(refresh_response.status_code, 401)
        self.assertEqual(AuthToken.objects.filter(revoked_at__isnull=False).count(), 1)
