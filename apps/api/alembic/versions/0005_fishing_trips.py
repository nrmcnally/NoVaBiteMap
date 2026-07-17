"""Add private angler-entered fishing trip logs.

Revision ID: 0005_fishing_trips
Revises: 0004_evidence_seasonal
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_fishing_trips"
down_revision = "0004_evidence_seasonal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fishing_trips",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.String(length=100), nullable=False),
        sa.Column("species_id", sa.String(length=100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("angler_count", sa.Integer(), nullable=False),
        sa.Column("effort_minutes", sa.Integer(), nullable=False),
        sa.Column("catch_count", sa.Integer(), nullable=False),
        sa.Column("zero_catch_explicit", sa.Boolean(), nullable=False),
        sa.Column("location_detail", sa.String(length=160), nullable=True),
        sa.Column("lure_or_bait", sa.String(length=160), nullable=True),
        sa.Column("observed_water_temperature_c", sa.Float(), nullable=True),
        sa.Column("observed_clarity", sa.String(length=30), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("consent_for_aggregate_analysis", sa.Boolean(), nullable=False),
        sa.Column("source_type", sa.String(length=40), nullable=False),
        sa.Column("candidate_cohort", sa.Boolean(), nullable=False),
        sa.Column("calibration_eligible", sa.Boolean(), nullable=False),
        sa.Column("validation_eligible", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["fishing_locations.id"]),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fishing_trips_user_id", "fishing_trips", ["user_id"])
    op.create_index("ix_fishing_trips_location_id", "fishing_trips", ["location_id"])
    op.create_index("ix_fishing_trips_species_id", "fishing_trips", ["species_id"])
    op.create_index("ix_fishing_trips_started_at", "fishing_trips", ["started_at"])


def downgrade() -> None:
    op.drop_index("ix_fishing_trips_started_at", table_name="fishing_trips")
    op.drop_index("ix_fishing_trips_species_id", table_name="fishing_trips")
    op.drop_index("ix_fishing_trips_location_id", table_name="fishing_trips")
    op.drop_index("ix_fishing_trips_user_id", table_name="fishing_trips")
    op.drop_table("fishing_trips")
