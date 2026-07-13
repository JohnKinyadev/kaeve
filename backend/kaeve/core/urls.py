from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("members", views.MemberViewSet)
router.register("users", views.UserProfileViewSet)
router.register("loan-policies", views.LoanPolicyViewSet)
router.register("collection-points", views.CollectionPointViewSet)
router.register("seasons", views.SeasonViewSet)
router.register("deliveries", views.DeliveryViewSet)
router.register("milling-batches", views.MillingBatchViewSet)
router.register("inventory-stocks", views.InventoryStockViewSet)
router.register("announcements", views.AnnouncementViewSet)
router.register("fertilizer-inventory", views.FertilizerInventoryViewSet)
router.register("fertilizer-requests", views.FertilizerRequestViewSet)
router.register("loans", views.LoanViewSet)
router.register("mpesa-transactions", views.MpesaTransactionViewSet)
router.register("loan-repayments", views.LoanRepaymentViewSet)
router.register("sale-proceeds", views.SaleProceedViewSet)
router.register("payouts", views.PayoutViewSet)
router.register("ledger-entries", views.LedgerEntryViewSet)

urlpatterns = [
    path("auth/register/", views.register, name="register"),
    path("auth/admin-register/", views.admin_register, name="admin-register"),
    path("auth/social/<str:provider>/start/", views.social_auth_start, name="social-auth-start"),
    path("auth/social/<str:provider>/callback/", views.social_auth_callback, name="social-auth-callback"),
    path("auth/login/", views.login, name="login"),
    path("auth/refresh/", views.refresh_access_token, name="refresh-access-token"),
    path("auth/logout/", views.logout, name="logout"),
    path("auth/me/", views.me, name="me"),
    path("auth/complete-member-profile/", views.complete_member_profile, name="complete-member-profile"),
    path("auth/update-login-credentials/", views.update_login_credentials, name="update-login-credentials"),
    path("loan-policy/current/", views.current_loan_policy, name="current-loan-policy"),
    path("members/guarantor-search/", views.guarantor_search, name="guarantor-search"),
    path("health/", views.health_check, name="health-check"),
    path("dashboard-summary/", views.dashboard_summary, name="dashboard-summary"),
    path("active-collection-points/", views.collection_points, name="active-collection-points"),
    path("seasons/<int:season_id>/intake-report/", views.season_intake_report, name="season-intake-report"),
    path("seasons/<int:season_id>/generate-payouts/", views.generate_payouts, name="generate-payouts"),
    path("payments/mpesa/stk-callback/", views.mpesa_stk_callback, name="mpesa-stk-callback"),
    path(
        "members/<int:member_id>/seasons/<int:season_id>/payout-statement/",
        views.payout_statement,
        name="payout-statement",
    ),
] + router.urls
