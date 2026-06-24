"""add composite indexes on usage_logs and diagnostic_events for admin dashboard queries.

Revision ID: 0003_add_composite_indexes
Revises: 0002_create_all_tables
Create Date: 2026-06-15
"""

from alembic import op

# revision identifiers
revision = "0003_add_composite_indexes"
down_revision = "0002_create_all_tables"
branch_labels = None
depends_on = None


def upgrade():
    # usage_logs: composite indexes for admin analytics
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_usage_logs_org_timestamp
        ON usage_logs(organization_id, timestamp DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_usage_logs_endpoint_status
        ON usage_logs(endpoint, status_code, timestamp DESC)
    """)

    # diagnostic_events: composite indexes for filtering/sorting
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_diagnostic_events_type_timestamp
        ON diagnostic_events(log_type, timestamp DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_diagnostic_events_endpoint_status_timestamp
        ON diagnostic_events(endpoint, status_code, timestamp DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_diagnostic_events_archived_type
        ON diagnostic_events(is_archived, log_type, timestamp DESC)
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_usage_logs_org_timestamp")
    op.execute("DROP INDEX IF EXISTS ix_usage_logs_endpoint_status")
    op.execute("DROP INDEX IF EXISTS ix_diagnostic_events_type_timestamp")
    op.execute("DROP INDEX IF EXISTS ix_diagnostic_events_endpoint_status_timestamp")
    op.execute("DROP INDEX IF EXISTS ix_diagnostic_events_archived_type")
