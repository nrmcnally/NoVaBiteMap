"""Phase 1 identity, favorites, provenance, locations, species evidence.

Revision ID: 0001_phase1
Revises:
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_phase1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(320), nullable=False), sa.Column("password_hash", sa.String(512), nullable=False), sa.Column("display_name", sa.String(120)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("email"))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("session_tokens", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("token_hash"))
    op.create_table("saved_locations", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("location_id", sa.String(100), nullable=False), sa.Column("nickname", sa.String(80)), sa.Column("notes", sa.Text()), sa.Column("preferred_species_id", sa.String(100)), sa.Column("default_access_method", sa.String(20)), sa.Column("sort_order", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("user_id", "location_id", name="uq_saved_user_location"))
    op.create_table("data_sources", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("provider", sa.String(100), nullable=False), sa.Column("source_url", sa.Text(), nullable=False), sa.Column("license_name", sa.String(200)), sa.Column("dataset_version", sa.String(100)), sa.Column("retrieved_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("name"))
    op.create_table("fishing_locations", sa.Column("id", sa.String(100), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("waterbody", sa.String(200), nullable=False), sa.Column("latitude", sa.Float(), nullable=False), sa.Column("longitude", sa.Float(), nullable=False), sa.Column("county", sa.String(100), nullable=False), sa.Column("public_access", sa.Boolean(), nullable=False), sa.Column("source_id", sa.Integer(), sa.ForeignKey("data_sources.id")))
    op.execute("ALTER TABLE fishing_locations ADD COLUMN geom geometry(Point, 4326)")
    op.execute("CREATE INDEX ix_fishing_locations_geom ON fishing_locations USING GIST (geom)")
    op.create_table("species", sa.Column("id", sa.String(100), primary_key=True), sa.Column("common_name", sa.String(120), nullable=False), sa.Column("scientific_name", sa.String(160), nullable=False), sa.Column("species_code", sa.String(20), nullable=False), sa.UniqueConstraint("common_name"), sa.UniqueConstraint("species_code"))
    op.create_table("species_evidence", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("location_id", sa.String(100), sa.ForeignKey("fishing_locations.id"), nullable=False), sa.Column("species_id", sa.String(100), sa.ForeignKey("species.id"), nullable=False), sa.Column("evidence_type", sa.String(80), nullable=False), sa.Column("presence_status", sa.String(20), nullable=False), sa.Column("confidence", sa.Float(), nullable=False), sa.Column("observed_at", sa.DateTime(timezone=True)), sa.Column("source_id", sa.Integer(), sa.ForeignKey("data_sources.id")), sa.Column("sampling_method", sa.String(160)), sa.Column("notes", sa.Text()))


def downgrade() -> None:
    op.drop_table("species_evidence")
    op.drop_table("species")
    op.drop_table("fishing_locations")
    op.drop_table("data_sources")
    op.drop_table("saved_locations")
    op.drop_table("session_tokens")
    op.drop_table("users")

