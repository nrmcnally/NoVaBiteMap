"""Add seasonal run-window to species_evidence.

Seasonal-run species (anadromous spawning runs) carry {months:[...], label} so the
scoring gates their availability by month and the UI can badge them distinctly.

Revision ID: 0004_evidence_seasonal
Revises: 0003_access_status
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_evidence_seasonal"
down_revision = "0003_access_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("species_evidence") as batch:
        batch.add_column(sa.Column("seasonal", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("species_evidence") as batch:
        batch.drop_column("seasonal")
