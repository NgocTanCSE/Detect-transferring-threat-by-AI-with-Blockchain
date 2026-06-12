import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
from alembic import context

# ---------------------------------------------------------------------
# Add the backend directory to sys.path so that "app" can be imported.
# The project structure is: <repo_root>/backend/...   
# Alembic runs from <repo_root>/backend, so we add the parent directory.
# ---------------------------------------------------------------------
current_dir = os.path.abspath(os.path.dirname(__file__))
project_root = os.path.abspath(os.path.join(current_dir, os.pardir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# this line enables logging configuration from the .ini file
if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)

# Import the model's MetaData object for 'autogenerate' support
from app.models import models as target_models  # noqa: E402

# target_metadata is the MetaData object that Alembic uses for "autogenerate".
target_metadata = target_models.Base.metadata

# ---------------------------------------------------------------------
# Alembic callbacks
# ---------------------------------------------------------------------

def run_migrations_offline():
    """Run migrations in 'offline' mode.
    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DB driver to be available.
    """
    url = context.get_x_argument(as_dictionary=True).get('url')
    if not url:
        # Fall back to DATABASE_URL env var.
        url = os.getenv('DATABASE_URL')
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.
    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    configuration = context.config.get_section(context.config.config_ini_section)
    configuration['sqlalchemy.url'] = os.getenv('DATABASE_URL')
    connectable = engine_from_config(
        configuration,
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # detect column type changes
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
