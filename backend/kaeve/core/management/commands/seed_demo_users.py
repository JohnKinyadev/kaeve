from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import CollectionPoint, Delivery, Member, SaleProceed, Season, UserProfile


DEMO_USERS = [
    {
        "username": "demo_admin",
        "email": "admin@example.com",
        "password": "Password123!",
        "role": UserProfile.Role.ADMIN,
        "is_staff": True,
        "is_superuser": True,
    },
    {
        "username": "demo_manager",
        "email": "manager@example.com",
        "password": "Password123!",
        "role": UserProfile.Role.MANAGER,
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "demo_field",
        "email": "field@example.com",
        "password": "Password123!",
        "role": UserProfile.Role.FIELD_OFFICER,
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "demo_member",
        "email": "member@example.com",
        "password": "Password123!",
        "role": UserProfile.Role.MEMBER,
        "is_staff": False,
        "is_superuser": False,
    },
]


class Command(BaseCommand):
    help = "Create demo users for testing role-based authentication."

    def handle(self, *args, **options):
        user_model = get_user_model()
        users = {}

        for demo_user in DEMO_USERS:
            user, created = user_model.objects.get_or_create(
                username=demo_user["username"],
                defaults={
                    "email": demo_user["email"],
                    "is_staff": demo_user["is_staff"],
                    "is_superuser": demo_user["is_superuser"],
                },
            )
            user.email = demo_user["email"]
            user.is_staff = demo_user["is_staff"]
            user.is_superuser = demo_user["is_superuser"]
            user.is_active = True
            user.set_password(demo_user["password"])
            user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = demo_user["role"]
            profile.save(update_fields=["role", "updated_at"])

            status = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{status}: {demo_user['username']} / {demo_user['password']} / role={demo_user['role']}"
                )
            )
            users[demo_user["username"]] = user

        season, _ = Season.objects.get_or_create(
            name="Demo Season 2026",
            season_type=Season.SeasonType.MAIN_CROP,
            defaults={"start_date": timezone.localdate()},
        )
        point, _ = CollectionPoint.objects.get_or_create(
            name="Demo Collection Point",
            defaults={"location": "Demo Farm Area"},
        )
        member, _ = Member.objects.get_or_create(
            membership_number="DEMO001",
            defaults={
                "user": users["demo_member"],
                "full_name": "Demo Member",
                "national_id": "DEMO001",
                "phone_number": "0700000000",
                "farm_size_acres": "1.50",
                "location": "Demo Farm Area",
            },
        )
        member.user = users["demo_member"]
        member.save(update_fields=["user", "updated_at"])

        Delivery.objects.get_or_create(
            member=member,
            season=season,
            collection_point=point,
            defaults={
                "recorded_by": users["demo_field"],
                "weight_kg": "50.00",
            },
        )
        SaleProceed.objects.get_or_create(
            season=season,
            buyer="Demo Buyer",
            defaults={
                "quantity_kg": "50.00",
                "gross_amount": "5000.00",
                "expenses": "500.00",
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"sample data ready: season_id={season.id}, collection_point_id={point.id}, member_id={member.id}"
            )
        )
