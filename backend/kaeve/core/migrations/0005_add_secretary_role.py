from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_remove_composite_unique_constraints"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("manager", "Manager"),
                    ("secretary", "Secretary"),
                    ("field_officer", "Field Officer"),
                    ("member", "Member"),
                ],
                default="member",
                max_length=20,
            ),
        ),
    ]
