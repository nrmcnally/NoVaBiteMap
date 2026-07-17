"""Add outcome-blind historical condition replay to private trips.

Revision ID: 0006_trip_condition_replay
Revises: 0005_fishing_trips
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_trip_condition_replay"
down_revision = "0005_fishing_trips"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fishing_trips", sa.Column("condition_replay_id", sa.String(length=36), nullable=True))
    op.add_column(
        "fishing_trips",
        sa.Column(
            "condition_replay_status",
            sa.String(length=20),
            nullable=False,
            server_default="not-requested",
        ),
    )
    op.add_column(
        "fishing_trips",
        sa.Column("condition_replay_policy_version", sa.String(length=40), nullable=True),
    )
    op.add_column("fishing_trips", sa.Column("condition_replay", sa.JSON(), nullable=True))
    op.add_column(
        "fishing_trips",
        sa.Column("condition_replayed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fishing_trips", "condition_replayed_at")
    op.drop_column("fishing_trips", "condition_replay")
    op.drop_column("fishing_trips", "condition_replay_policy_version")
    op.drop_column("fishing_trips", "condition_replay_status")
    op.drop_column("fishing_trips", "condition_replay_id")
