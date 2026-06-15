from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.login, name="login"),
    path("auth/refresh/", views.refresh_access_token, name="refresh-access-token"),
    path("auth/logout/", views.logout, name="logout"),
    path("auth/me/", views.me, name="me"),
    path("health/", views.health_check, name="health-check"),
    path("dashboard-summary/", views.dashboard_summary, name="dashboard-summary"),
    path("collection-points/", views.collection_points, name="collection-points"),
    path("seasons/<int:season_id>/intake-report/", views.season_intake_report, name="season-intake-report"),
    path("seasons/<int:season_id>/generate-payouts/", views.generate_payouts, name="generate-payouts"),
]
