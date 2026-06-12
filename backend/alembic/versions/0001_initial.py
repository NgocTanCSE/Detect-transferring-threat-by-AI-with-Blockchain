"""initial migration – creates Alembic version table only.
We rely on app.core.database.ensure_schema() for actual table creation.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_initial"
 down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # No explicit table creation – ensure_schema will run on app start.
    # This migration exists so that Alembic tracks that the database has been
    # initialized. Future migrations should use op.create_table / op.add_column
    # as needed.
    pass


def downgrade():
    # No downgrade actions – tables are managed by ensure_schema().
    pass
