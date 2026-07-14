"""Add access_status to fishing_locations (verified | listed | unverified).

Revision ID: 0003_access_status
Revises: 0002_intelligence_core
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_access_status"
down_revision = "0002_intelligence_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("fishing_locations") as batch:
        batch.add_column(sa.Column("access_status", sa.String(20), nullable=False, server_default="verified"))


def downgrade() -> None:
    with op.batch_alter_table("fishing_locations") as batch:
        batch.drop_column("access_status")
