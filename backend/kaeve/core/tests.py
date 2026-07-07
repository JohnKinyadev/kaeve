import json
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import (
    AuthToken,
    CollectionPoint,
    Delivery,
    InventoryStock,
    LedgerEntry,
    Loan,
    Member,
    Payout,
    SaleProceed,
    Season,
    UserProfile,
)
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
        self.assertEqual(member_one.payouts.get(season=season).net_payable, Decimal("5725.00"))
        self.assertEqual(member_two.payouts.get(season=season).net_payable, Decimal("2250.00"))


class RoleProtectedApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin_user = get_user_model().objects.create_user(username="manager", password="password")
        self.admin_user.profile.role = UserProfile.Role.ADMIN
        self.admin_user.profile.save()
        self.manager_user = get_user_model().objects.create_user(username="ops-manager", password="password")
        self.manager_user.profile.role = UserProfile.Role.MANAGER
        self.manager_user.profile.save()
        self.field_user = get_user_model().objects.create_user(username="field", password="password")
        self.field_user.profile.role = UserProfile.Role.FIELD_OFFICER
        self.field_user.profile.save()
        self.secretary_user = get_user_model().objects.create_user(username="secretary", password="password")
        self.secretary_user.profile.role = UserProfile.Role.SECRETARY
        self.secretary_user.profile.save()
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

    def test_dashboard_allows_manager_role(self):
        self.client.login(username="ops-manager", password="password")

        response = self.client.get("/api/dashboard-summary/")

        self.assertEqual(response.status_code, 200)

    def test_dashboard_allows_secretary_role(self):
        self.client.login(username="secretary", password="password")

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

    def test_generate_payouts_allows_manager_role(self):
        season = Season.objects.create(
            name="Fly Crop 2026",
            season_type=Season.SeasonType.FLY_CROP,
            start_date=timezone.localdate(),
        )
        self.client.login(username="ops-manager", password="password")

        response = self.client.post(f"/api/seasons/{season.id}/generate-payouts/")

        self.assertIn(response.status_code, {200, 400})

    def test_secretary_can_create_loan_but_not_approve(self):
        member = Member.objects.create(
            membership_number="SEC001",
            full_name="Secretary Loan Member",
            national_id="SEC001",
            farm_size_acres=Decimal("1.50"),
            location="Kiambu",
        )
        season = Season.objects.create(
            name="Secretary Season",
            season_type=Season.SeasonType.MAIN_CROP,
            start_date=timezone.localdate(),
        )
        self.client.login(username="secretary", password="password")

        create_response = self.client.post(
            "/api/loans/",
            json.dumps(
                {
                    "member": member.id,
                    "season": season.id,
                    "amount": "500.00",
                    "reason": "Fertilizer",
                }
            ),
            content_type="application/json",
        )
        loan = Loan.objects.get(member=member)
        approve_response = self.client.post(f"/api/loans/{loan.id}/approve/")

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(approve_response.status_code, 403)

    def test_member_can_apply_for_own_loan_but_not_approve(self):
        member = Member.objects.create(
            user=self.member_user,
            membership_number="MEMLOAN001",
            full_name="Member Loan Applicant",
            national_id="MEMLOAN001",
            farm_size_acres=Decimal("1.50"),
            location="Kiambu",
        )
        season = Season.objects.create(
            name="Member Loan Season",
            season_type=Season.SeasonType.MAIN_CROP,
            start_date=timezone.localdate(),
        )
        self.client.login(username="member", password="password")

        apply_response = self.client.post(
            "/api/loans/apply/",
            json.dumps({"amount": "750.00", "reason": "Farm inputs"}),
            content_type="application/json",
        )
        loan = Loan.objects.get(member=member, season=season)
        approve_response = self.client.post(f"/api/loans/{loan.id}/approve/")

        self.assertEqual(apply_response.status_code, 201)
        self.assertEqual(loan.status, Loan.Status.PENDING)
        self.assertEqual(approve_response.status_code, 403)

    def test_secretary_can_view_and_create_deliveries(self):
        member = Member.objects.create(
            membership_number="DEL001",
            full_name="Secretary Delivery Member",
            national_id="DEL001",
            farm_size_acres=Decimal("1.50"),
            location="Kiambu",
        )
        season = Season.objects.create(
            name="Delivery Season",
            season_type=Season.SeasonType.MAIN_CROP,
            start_date=timezone.localdate(),
        )
        point = CollectionPoint.objects.create(name="Secretary Point", location="Kiambu")
        self.client.login(username="secretary", password="password")

        list_response = self.client.get("/api/deliveries/")
        create_response = self.client.post(
            "/api/deliveries/",
            json.dumps(
                {
                    "member": member.id,
                    "season": season.id,
                    "collection_point": point.id,
                    "weight_kg": "25.00",
                    "grade": Delivery.Grade.UNGRADED,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(create_response.status_code, 201)

    def test_admin_can_promote_user_role(self):
        self.client.login(username="manager", password="password")

        response = self.client.patch(
            f"/api/users/{self.member_user.profile.id}/",
            json.dumps({"role": UserProfile.Role.SECRETARY}),
            content_type="application/json",
        )
        self.member_user.profile.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.member_user.profile.role, UserProfile.Role.SECRETARY)

    def test_manager_cannot_promote_user_role(self):
        self.client.login(username="ops-manager", password="password")

        response = self.client.patch(
            f"/api/users/{self.member_user.profile.id}/",
            json.dumps({"role": UserProfile.Role.SECRETARY}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)


class TokenAuthTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = get_user_model().objects.create_user(username="manager", password="password")
        self.user.profile.role = UserProfile.Role.ADMIN
        self.user.profile.save()

    def test_register_creates_member_user_and_tokens(self):
        response = self.client.post(
            "/api/auth/register/",
            json.dumps(
                {
                    "username": "new-member",
                    "email": "new-member@example.com",
                    "password": "Password123!",
                }
            ),
            content_type="application/json",
        )

        user = get_user_model().objects.get(username="new-member")

        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())
        self.assertEqual(user.profile.role, UserProfile.Role.MEMBER)
        self.assertEqual(response.json()["user"]["role"], UserProfile.Role.MEMBER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_register_can_create_linked_member_profile(self):
        response = self.client.post(
            "/api/auth/register/",
            json.dumps(
                {
                    "username": "linked-member",
                    "email": "linked-member@example.com",
                    "password": "Password123!",
                    "full_name": "Linked Member",
                    "national_id": "LINKED001",
                    "phone_number": "0711222333",
                    "farm_size_acres": "2.50",
                    "location": "Kiamumbi",
                }
            ),
            content_type="application/json",
        )

        user = get_user_model().objects.get(username="linked-member")
        member = Member.objects.get(user=user)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(member.full_name, "Linked Member")
        self.assertEqual(member.membership_number, f"MEM{user.id:05d}")

    def test_member_can_complete_missing_profile(self):
        user = get_user_model().objects.create_user(
            username="social-member",
            email="social-member@example.com",
            password="password",
        )
        user.profile.role = UserProfile.Role.MEMBER
        user.profile.save()
        self.client.login(username="social-member", password="password")

        response = self.client.post(
            "/api/auth/complete-member-profile/",
            json.dumps(
                {
                    "full_name": "Social Member",
                    "national_id": "SOCIAL001",
                    "phone_number": "0711222444",
                    "farm_size_acres": "1.75",
                    "location": "Kiambu",
                }
            ),
            content_type="application/json",
        )
        user.refresh_from_db()
        member = user.member_profile

        self.assertEqual(response.status_code, 201)
        self.assertEqual(member.full_name, "Social Member")
        self.assertEqual(response.json()["member"]["id"], member.id)

    def test_register_rejects_privileged_role(self):
        response = self.client.post(
            "/api/auth/register/",
            json.dumps(
                {
                    "username": "new-manager",
                    "password": "Password123!",
                    "role": UserProfile.Role.MANAGER,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Public registration only allows member accounts.")
        self.assertFalse(get_user_model().objects.filter(username="new-manager").exists())

    def test_register_rejects_invalid_role(self):
        response = self.client.post(
            "/api/auth/register/",
            json.dumps(
                {
                    "username": "new-user",
                    "password": "Password123!",
                    "role": "owner",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid role.")

    def test_register_rejects_duplicate_username(self):
        response = self.client.post(
            "/api/auth/register/",
            json.dumps(
                {
                    "username": "manager",
                    "password": "Password123!",
                    "role": UserProfile.Role.MEMBER,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Username is already taken.")

    def test_admin_register_creates_privileged_user(self):
        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager", "password": "password"}),
            content_type="application/json",
        )
        access_token = login_response.json()["access"]

        response = self.client.post(
            "/api/auth/admin-register/",
            json.dumps(
                {
                    "username": "new-admin",
                    "email": "new-admin@example.com",
                    "password": "Password123!",
                    "role": UserProfile.Role.ADMIN,
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        user = get_user_model().objects.get(username="new-admin")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], UserProfile.Role.ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_login_returns_access_and_refresh_tokens(self):
        response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager", "password": "password"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())

    def test_login_accepts_email_as_identifier(self):
        self.user.email = "manager@example.com"
        self.user.save(update_fields=["email"])

        response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "manager@example.com", "password": "password"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_social_auth_start_redirects_to_provider(self):
        with patch.dict("os.environ", {"GOOGLE_OAUTH_CLIENT_ID": "google-client"}):
            response = self.client.get("/api/auth/social/google/start/?next=/dashboard")

        self.assertEqual(response.status_code, 302)
        self.assertIn("accounts.google.com", response["Location"])

    def test_social_auth_start_requires_provider_configuration(self):
        response = self.client.get("/api/auth/social/github/start/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Github OAuth is not configured.")

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

    def test_me_returns_member_profile_for_member_user(self):
        member_user = get_user_model().objects.create_user(
            username="profile-member",
            password="password",
        )
        member_user.profile.role = UserProfile.Role.MEMBER
        member_user.profile.save()
        Member.objects.create(
            user=member_user,
            membership_number="PROFILE001",
            full_name="Profile Member",
            national_id="PROFILE001",
            phone_number="0700111222",
            farm_size_acres="1.25",
            location="Karura",
        )
        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "profile-member", "password": "password"}),
            content_type="application/json",
        )
        access_token = login_response.json()["access"]

        response = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["member"]["full_name"], "Profile Member")

    def test_staff_access_token_is_treated_as_admin_role(self):
        staff_user = get_user_model().objects.create_user(
            username="staff-admin",
            password="password",
            is_staff=True,
        )

        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "staff-admin", "password": "password"}),
            content_type="application/json",
        )
        access_token = login_response.json()["access"]

        response = self.client.get(
            "/api/dashboard-summary/",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 200)

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


class CrudApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin_user = get_user_model().objects.create_user(username="admin", password="password")
        self.admin_user.profile.role = UserProfile.Role.ADMIN
        self.admin_user.profile.save()

        login_response = self.client.post(
            "/api/auth/login/",
            json.dumps({"username": "admin", "password": "password"}),
            content_type="application/json",
        )
        self.access_token = login_response.json()["access"]

    def api_headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.access_token}"}

    def create_member(self, suffix="100"):
        return Member.objects.create(
            membership_number=f"KC{suffix}",
            full_name=f"Member {suffix}",
            national_id=f"ID{suffix}",
            phone_number="0712345678",
            farm_size_acres=Decimal("3.25"),
            location="Nyeri",
            status=Member.Status.ACTIVE,
        )

    def create_season(self):
        return Season.objects.create(
            name="Main Crop 2026",
            season_type=Season.SeasonType.MAIN_CROP,
            start_date=timezone.localdate(),
        )

    def test_admin_can_crud_members(self):
        create_response = self.client.post(
            "/api/members/",
            json.dumps(
                {
                    "membership_number": "KC100",
                    "full_name": "Mary Njeri",
                    "national_id": "98765432",
                    "phone_number": "0712345678",
                    "farm_size_acres": "3.25",
                    "location": "Nyeri",
                    "status": Member.Status.ACTIVE,
                }
            ),
            content_type="application/json",
            **self.api_headers(),
        )

        self.assertEqual(create_response.status_code, 201)
        member_id = create_response.json()["id"]
        self.assertTrue(Member.objects.filter(id=member_id).exists())

        list_response = self.client.get("/api/members/", **self.api_headers())

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["count"], 1)

        update_response = self.client.patch(
            f"/api/members/{member_id}/",
            json.dumps({"status": Member.Status.SUSPENDED}),
            content_type="application/json",
            **self.api_headers(),
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["status"], Member.Status.SUSPENDED)

        delete_response = self.client.delete(f"/api/members/{member_id}/", **self.api_headers())

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Member.objects.filter(id=member_id).exists())

    def test_delivery_create_updates_inventory_and_ledger(self):
        member = self.create_member()
        season = self.create_season()
        point = CollectionPoint.objects.create(name="Kiamumbi", location="Kiambu")

        response = self.client.post(
            "/api/deliveries/",
            json.dumps(
                {
                    "member": member.id,
                    "season": season.id,
                    "collection_point": point.id,
                    "weight_kg": "75.00",
                    "grade": Delivery.Grade.GRADE_A,
                }
            ),
            content_type="application/json",
            **self.api_headers(),
        )

        self.assertEqual(response.status_code, 201)
        stock = InventoryStock.objects.get(
            season=season,
            stock_type=InventoryStock.StockType.CHERRY,
            warehouse=point.name,
        )
        self.assertEqual(stock.quantity_kg, Decimal("75.00"))
        self.assertTrue(
            LedgerEntry.objects.filter(
                member=member,
                season=season,
                entry_type=LedgerEntry.EntryType.DELIVERY,
                reference=f"delivery:{response.json()['id']}",
            ).exists()
        )

    def test_milling_batch_moves_inventory(self):
        season = self.create_season()
        InventoryStock.objects.create(
            season=season,
            stock_type=InventoryStock.StockType.CHERRY,
            warehouse="Milling",
            quantity_kg=Decimal("100.00"),
        )

        response = self.client.post(
            "/api/milling-batches/",
            json.dumps(
                {
                    "season": season.id,
                    "batch_number": "MB-001",
                    "cherry_in_kg": "100.00",
                    "parchment_out_kg": "22.00",
                    "green_bean_out_kg": "18.00",
                }
            ),
            content_type="application/json",
            **self.api_headers(),
        )

        self.assertEqual(response.status_code, 201)
        cherry = InventoryStock.objects.get(
            season=season,
            stock_type=InventoryStock.StockType.CHERRY,
            warehouse="Milling",
        )
        green = InventoryStock.objects.get(
            season=season,
            stock_type=InventoryStock.StockType.GREEN_BEAN,
            warehouse="Milling",
        )
        self.assertEqual(cherry.quantity_kg, Decimal("0.00"))
        self.assertEqual(green.quantity_kg, Decimal("18.00"))

    def test_loan_approve_action_updates_status_and_ledger(self):
        member = self.create_member()
        season = self.create_season()
        loan = Loan.objects.create(
            member=member,
            season=season,
            amount=Decimal("500.00"),
            reason="Fertilizer",
        )

        response = self.client.post(f"/api/loans/{loan.id}/approve/", **self.api_headers())

        loan.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(loan.status, Loan.Status.APPROVED)
        self.assertEqual(loan.reviewed_by, self.admin_user)
        self.assertTrue(
            LedgerEntry.objects.filter(
                member=member,
                season=season,
                entry_type=LedgerEntry.EntryType.LOAN,
                reference=f"loan:{loan.id}",
            ).exists()
        )

    def test_payout_statement_returns_member_season_summary(self):
        member = self.create_member()
        season = self.create_season()
        Payout.objects.create(
            member=member,
            season=season,
            delivered_kg=Decimal("75.00"),
            gross_share=Decimal("6000.00"),
            loan_deductions=Decimal("500.00"),
            net_payable=Decimal("5500.00"),
            generated_by=self.admin_user,
        )

        response = self.client.get(
            f"/api/members/{member.id}/seasons/{season.id}/payout-statement/",
            **self.api_headers(),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["member"]["membership_number"], member.membership_number)
        self.assertEqual(response.json()["totals"]["net_payable"], "5500.00")

    def test_members_list_supports_search_filter_and_pagination(self):
        self.create_member("101")
        self.create_member("102")

        response = self.client.get(
            "/api/members/?search=Member 101&status=active&page=1",
            **self.api_headers(),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["membership_number"], "KC101")
