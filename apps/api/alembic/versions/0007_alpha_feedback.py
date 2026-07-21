"""Add durable alpha-tester feedback.

Revision ID: 0007_alpha_feedback
Revises: 0006_trip_condition_replay
Create Date: 2026-07-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_alpha_feedback"
down_revision = "0006_trip_condition_replay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alpha_feedback",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.String(length=100), nullable=True),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("page_url", sa.String(length=500), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("contact_ok", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["fishing_locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alpha_feedback_user_id", "alpha_feedback", ["user_id"])
    op.create_index("ix_alpha_feedback_location_id", "alpha_feedback", ["location_id"])
    op.create_index("ix_alpha_feedback_category", "alpha_feedback", ["category"])
    op.create_index("ix_alpha_feedback_status", "alpha_feedback", ["status"])
    op.create_index("ix_alpha_feedback_created_at", "alpha_feedback", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_alpha_feedback_created_at", table_name="alpha_feedback")
    op.drop_index("ix_alpha_feedback_status", table_name="alpha_feedback")
    op.drop_index("ix_alpha_feedback_category", table_name="alpha_feedback")
    op.drop_index("ix_alpha_feedback_location_id", table_name="alpha_feedback")
    op.drop_index("ix_alpha_feedback_user_id", table_name="alpha_feedback")
    op.drop_table("alpha_feedback")
