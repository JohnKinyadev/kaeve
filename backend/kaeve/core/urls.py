from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("members", views.MemberViewSet)
router.register("collection-points", views.CollectionPointViewSet)
router.register("seasons", views.SeasonViewSet)
router.register("deliveries", views.DeliveryViewSet)
router.register("milling-batches", views.MillingBatchViewSet)
router.register("inventory-stocks", views.InventoryStockViewSet)
router.register("loans", views.LoanViewSet)
router.register("sale-proceeds", views.SaleProceedViewSet)
router.register("payouts", views.PayoutViewSet)
router.register("ledger-entries", views.LedgerEntryViewSet)

urlpatterns = [
    path("auth/register/", views.register, name="register"),
    path("auth/admin-register/", views.admin_register, name="admin-register"),
    path("auth/login/", views.login, name="login"),
    path("auth/refresh/", views.refresh_access_token, name="refresh-access-token"),
    path("auth/logout/", views.logout, name="logout"),
    path("auth/me/", views.me, name="me"),
    path("health/", views.health_check, name="health-check"),
    path("dashboard-summary/", views.dashboard_summary, name="dashboard-summary"),
    path("active-collection-points/", views.collection_points, name="active-collection-points"),
    path("seasons/<int:season_id>/intake-report/", views.season_intake_report, name="season-intake-report"),
    path("seasons/<int:season_id>/generate-payouts/", views.generate_payouts, name="generate-payouts"),
    path(
        "members/<int:member_id>/seasons/<int:season_id>/payout-statement/",
        views.payout_statement,
        name="payout-statement",
    ),
] + router.urls
