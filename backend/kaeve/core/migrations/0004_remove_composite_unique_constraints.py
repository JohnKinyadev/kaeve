from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_alter_userprofile_role"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="season",
            name="unique_season_name_and_type",
        ),
        migrations.RemoveConstraint(
            model_name="inventorystock",
            name="unique_stock_per_season_type_warehouse",
        ),
        migrations.RemoveConstraint(
            model_name="payout",
            name="unique_member_season_payout",
        ),
        migrations.RemoveConstraint(
            model_name="ledgerentry",
            name="unique_ledger_reference_per_member_season",
        ),
    ]
