"""create all tables matching SQLAlchemy models.

Revision ID: 0002_create_all_tables
Revises: 0001_initial
Create Date: 2026-06-14
"""

from alembic import op

# revision identifiers
revision = "0002_create_all_tables"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    _create_organizations()
    _create_users()
    _create_wallets()
    _create_token_transfers()
    _create_transactions()
    _create_risk_assessments()
    _create_blacklist()
    _create_alerts()
    _create_blocked_transfers()
    _create_user_warnings()
    _create_audit_logs()
    _create_feedback_labels()
    _create_transaction_cases()
    _create_node_endpoints()
    _create_pipeline_metrics()
    _create_feature_store_configs()
    _create_model_registry()
    _create_policy_rules()
    _create_notification_events()
    _create_diagnostic_events()
    _create_money_flow_snapshots()
    _create_compliance_kpis()
    _create_system_health_snapshots()
    _create_ai_threat_logs()
    _create_usage_logs()
    _create_auth_sessions()


def downgrade():
    _drop_auth_sessions()
    _drop_usage_logs()
    _drop_ai_threat_logs()
    _drop_system_health_snapshots()
    _drop_compliance_kpis()
    _drop_money_flow_snapshots()
    _drop_diagnostic_events()
    _drop_notification_events()
    _drop_policy_rules()
    _drop_model_registry()
    _drop_feature_store_configs()
    _drop_pipeline_metrics()
    _drop_node_endpoints()
    _drop_transaction_cases()
    _drop_feedback_labels()
    _drop_audit_logs()
    _drop_user_warnings()
    _drop_blocked_transfers()
    _drop_alerts()
    _drop_blacklist()
    _drop_risk_assessments()
    _drop_transactions()
    _drop_token_transfers()
    _drop_wallets()
    _drop_users()
    _drop_organizations()


def _create_organizations():
    op.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            contact_email VARCHAR(255),
            api_key VARCHAR(255),
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_organizations_name ON organizations(name)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_organizations_slug ON organizations(slug)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_organizations_api_key ON organizations(api_key)")


def _create_users():
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            organization_id TEXT REFERENCES organizations(id),
            wallet_address VARCHAR(255),
            is_active BOOLEAN DEFAULT 1,
            warning_count INTEGER DEFAULT 0,
            last_login_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wallet_address ON users(wallet_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_organization_id ON users(organization_id)")


def _create_wallets():
    op.execute("""
        CREATE TABLE IF NOT EXISTS wallets (
            id TEXT PRIMARY KEY,
            address VARCHAR(255) NOT NULL,
            label VARCHAR(255),
            entity_type VARCHAR(50) DEFAULT 'Unknown',
            organization_id TEXT REFERENCES organizations(id),
            account_status VARCHAR(20) DEFAULT 'active',
            risk_score FLOAT DEFAULT 0.0,
            risk_category VARCHAR(50),
            total_transactions BIGINT DEFAULT 0,
            total_value_sent DECIMAL(78,0) DEFAULT 0,
            total_value_received DECIMAL(78,0) DEFAULT 0,
            first_seen_at TIMESTAMP,
            last_activity_at TIMESTAMP,
            flagged_at TIMESTAMP,
            flagged_by VARCHAR(255),
            notes TEXT,
            chain_id VARCHAR(50) DEFAULT 'ethereum',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_wallets_address ON wallets(address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wallets_chain_id ON wallets(chain_id)")


def _create_token_transfers():
    op.execute("""
        CREATE TABLE IF NOT EXISTS token_transfers (
            id TEXT PRIMARY KEY,
            transaction_hash VARCHAR(66) NOT NULL,
            block_number BIGINT NOT NULL,
            log_index BIGINT NOT NULL,
            token_address VARCHAR(255) NOT NULL,
            token_symbol VARCHAR(20),
            token_name VARCHAR(100),
            token_decimals BIGINT DEFAULT 18,
            from_address VARCHAR(255) NOT NULL,
            to_address VARCHAR(255) NOT NULL,
            value DECIMAL(78,0) NOT NULL,
            value_decimal DECIMAL(38,18),
            transfer_type VARCHAR(20) DEFAULT 'ERC20',
            organization_id TEXT REFERENCES organizations(id),
            timestamp TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_transfers_transaction_hash ON token_transfers(transaction_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_transfers_token_address ON token_transfers(token_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_transfers_from_address ON token_transfers(from_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_transfers_to_address ON token_transfers(to_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_transfers_organization_id ON token_transfers(organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_token_transfers_timestamp ON token_transfers(timestamp)")


def _create_transactions():
    op.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            tx_hash VARCHAR(66) NOT NULL,
            from_address VARCHAR(255) NOT NULL,
            to_address VARCHAR(255),
            value DECIMAL(78,0),
            block_number BIGINT,
            timestamp TIMESTAMP,
            gas_price DECIMAL(78,0),
            gas_used BIGINT,
            input_data TEXT,
            status SMALLINT DEFAULT 1,
            normalized_risk_score DECIMAL(3,2),
            case_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            assigned_to TEXT REFERENCES users(id),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_flagged BOOLEAN DEFAULT 0,
            flag_reason VARCHAR(100),
            organization_id TEXT REFERENCES organizations(id),
            chain_id VARCHAR(50) DEFAULT 'ethereum',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_transactions_tx_hash ON transactions(tx_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transactions_from_address ON transactions(from_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transactions_to_address ON transactions(to_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transactions_timestamp ON transactions(timestamp)")


def _create_risk_assessments():
    op.execute("""
        CREATE TABLE IF NOT EXISTS risk_assessments (
            id TEXT PRIMARY KEY,
            wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE,
            score FLOAT NOT NULL,
            risk_level VARCHAR(20) NOT NULL,
            details TEXT,
            model_version VARCHAR(50),
            assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_risk_assessments_wallet_id ON risk_assessments(wallet_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_risk_assessments_assessed_at ON risk_assessments(assessed_at)")


def _create_blacklist():
    op.execute("""
        CREATE TABLE IF NOT EXISTS blacklist (
            id TEXT PRIMARY KEY,
            address VARCHAR(255) NOT NULL,
            category VARCHAR(100),
            source VARCHAR(255),
            description TEXT,
            severity VARCHAR(20) DEFAULT 'HIGH',
            is_active BOOLEAN DEFAULT 1,
            reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            verified_at TIMESTAMP,
            expires_at TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_blacklist_address ON blacklist(address)")


def _create_alerts():
    op.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            wallet_address VARCHAR(255) NOT NULL,
            alert_type VARCHAR(100) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            risk_score FLOAT,
            "metadata" TEXT,
            chain_id VARCHAR(50) DEFAULT 'ethereum',
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            acknowledged BOOLEAN DEFAULT 0,
            acknowledged_at TIMESTAMP,
            acknowledged_by VARCHAR(255),
            organization_id TEXT REFERENCES organizations(id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_wallet_address ON alerts(wallet_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_detected_at ON alerts(detected_at)")


def _create_blocked_transfers():
    op.execute("""
        CREATE TABLE IF NOT EXISTS blocked_transfers (
            id TEXT PRIMARY KEY,
            sender_address VARCHAR(255) NOT NULL,
            receiver_address VARCHAR(255) NOT NULL,
            amount DECIMAL(78,0) NOT NULL,
            risk_score FLOAT,
            block_reason VARCHAR(100) NOT NULL,
            chain_id VARCHAR(50) DEFAULT 'ethereum',
            user_warning_count INTEGER DEFAULT 0,
            sender_user_id TEXT REFERENCES users(id),
            organization_id TEXT REFERENCES organizations(id),
            blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_blocked_transfers_sender_address ON blocked_transfers(sender_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_blocked_transfers_receiver_address ON blocked_transfers(receiver_address)")


def _create_user_warnings():
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_warnings (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            wallet_address VARCHAR(255) NOT NULL,
            target_address VARCHAR(255) NOT NULL,
            warning_type VARCHAR(50) NOT NULL,
            risk_score FLOAT,
            user_action VARCHAR(20),
            warning_number INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_warnings_user_id ON user_warnings(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_warnings_wallet_address ON user_warnings(wallet_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_warnings_created_at ON user_warnings(created_at)")


def _create_audit_logs():
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            action_type VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id TEXT,
            user_identifier VARCHAR(255),
            ip_address VARCHAR(45),
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_action_type ON audit_logs(action_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type ON audit_logs(entity_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs(timestamp)")


def _create_feedback_labels():
    op.execute("""
        CREATE TABLE IF NOT EXISTS feedback_labels (
            id TEXT PRIMARY KEY,
            wallet_address VARCHAR(255) NOT NULL,
            ai_score FLOAT NOT NULL,
            ai_risk_level VARCHAR(20) NOT NULL,
            ai_model_version VARCHAR(50),
            admin_label VARCHAR(20) NOT NULL,
            admin_category VARCHAR(50),
            admin_notes TEXT,
            admin_username VARCHAR(100) NOT NULL,
            used_for_training BOOLEAN DEFAULT 0,
            training_batch_id VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_feedback_labels_wallet_address ON feedback_labels(wallet_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_feedback_labels_used_for_training ON feedback_labels(used_for_training)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_feedback_labels_created_at ON feedback_labels(created_at)")


def _create_transaction_cases():
    op.execute("""
        CREATE TABLE IF NOT EXISTS transaction_cases (
            id TEXT PRIMARY KEY,
            tx_hash VARCHAR(66) NOT NULL,
            analyst_id TEXT REFERENCES users(id),
            action VARCHAR(20) NOT NULL,
            state VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_transaction_cases_tx_hash ON transaction_cases(tx_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transaction_cases_analyst_id ON transaction_cases(analyst_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transaction_cases_created_at ON transaction_cases(created_at)")


def _create_node_endpoints():
    op.execute("""
        CREATE TABLE IF NOT EXISTS node_endpoints (
            id TEXT PRIMARY KEY,
            provider_name VARCHAR(100) NOT NULL,
            chain VARCHAR(50) NOT NULL,
            endpoint_url VARCHAR(1024) NOT NULL,
            protocol VARCHAR(20) NOT NULL DEFAULT 'http',
            priority INTEGER NOT NULL DEFAULT 100,
            is_active BOOLEAN DEFAULT 1,
            health_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
            last_error TEXT,
            last_checked_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_node_endpoints_provider_name ON node_endpoints(provider_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_node_endpoints_chain ON node_endpoints(chain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_node_endpoints_is_active ON node_endpoints(is_active)")


def _create_pipeline_metrics():
    op.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_metrics (
            id BIGINT PRIMARY KEY,
            chain VARCHAR(50) NOT NULL,
            block_number BIGINT,
            throughput_tps DECIMAL(10,2),
            ingestion_latency_ms INTEGER,
            decode_latency_ms INTEGER,
            inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pipeline_metrics_chain ON pipeline_metrics(chain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pipeline_metrics_block_number ON pipeline_metrics(block_number)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pipeline_metrics_inserted_at ON pipeline_metrics(inserted_at)")


def _create_feature_store_configs():
    op.execute("""
        CREATE TABLE IF NOT EXISTS feature_store_configs (
            id TEXT PRIMARY KEY,
            feature_key VARCHAR(100) NOT NULL,
            enabled BOOLEAN DEFAULT 1,
            expression TEXT,
            owner_user_id TEXT REFERENCES users(id),
            organization_id TEXT REFERENCES organizations(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_feature_store_configs_feature_key ON feature_store_configs(feature_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_feature_store_configs_enabled ON feature_store_configs(enabled)")


def _create_model_registry():
    op.execute("""
        CREATE TABLE IF NOT EXISTS model_registry (
            id TEXT PRIMARY KEY,
            model_name VARCHAR(100) NOT NULL,
            version VARCHAR(50) NOT NULL,
            artifact_uri VARCHAR(1024) NOT NULL,
            framework VARCHAR(20) NOT NULL DEFAULT 'pkl',
            is_active BOOLEAN DEFAULT 0,
            promoted_by TEXT REFERENCES users(id),
            promoted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_model_registry_model_name ON model_registry(model_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_model_registry_version ON model_registry(version)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_model_registry_is_active ON model_registry(is_active)")


def _create_policy_rules():
    op.execute("""
        CREATE TABLE IF NOT EXISTS policy_rules (
            id TEXT PRIMARY KEY,
            rule_name VARCHAR(120) NOT NULL,
            description TEXT,
            min_risk_score FLOAT NOT NULL DEFAULT 80.0,
            block_blacklisted BOOLEAN DEFAULT 1,
            block_suspended BOOLEAN DEFAULT 1,
            notify_on_block BOOLEAN DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 100,
            is_active BOOLEAN DEFAULT 1,
            created_by TEXT REFERENCES users(id),
            organization_id TEXT REFERENCES organizations(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_policy_rules_rule_name ON policy_rules(rule_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_policy_rules_is_active ON policy_rules(is_active)")


def _create_notification_events():
    op.execute("""
        CREATE TABLE IF NOT EXISTS notification_events (
            id TEXT PRIMARY KEY,
            channel VARCHAR(30) NOT NULL,
            recipient VARCHAR(255) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
            message TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            "metadata" TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_notification_events_channel ON notification_events(channel)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notification_events_severity ON notification_events(severity)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notification_events_status ON notification_events(status)")


def _create_diagnostic_events():
    op.execute("""
        CREATE TABLE IF NOT EXISTS diagnostic_events (
            id TEXT PRIMARY KEY,
            log_type VARCHAR(30) NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            status_code INTEGER,
            endpoint VARCHAR(255),
            source VARCHAR(50) NOT NULL DEFAULT 'backend',
            is_archived BOOLEAN NOT NULL DEFAULT 0,
            archived_at TIMESTAMP,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnostic_events_log_type ON diagnostic_events(log_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnostic_events_status_code ON diagnostic_events(status_code)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnostic_events_endpoint ON diagnostic_events(endpoint)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnostic_events_is_archived ON diagnostic_events(is_archived)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnostic_events_timestamp ON diagnostic_events(timestamp)")


def _create_money_flow_snapshots():
    op.execute("""
        CREATE TABLE IF NOT EXISTS money_flow_snapshots (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            inflow_eth FLOAT DEFAULT 0.0,
            outflow_eth FLOAT DEFAULT 0.0,
            chain_id VARCHAR(50) DEFAULT 'ethereum',
            wallet_address VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_money_flow_snapshots_timestamp ON money_flow_snapshots(timestamp)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_money_flow_snapshots_chain_id ON money_flow_snapshots(chain_id)")


def _create_compliance_kpis():
    op.execute("""
        CREATE TABLE IF NOT EXISTS compliance_kpis (
            id TEXT PRIMARY KEY,
            metric_key VARCHAR(100) NOT NULL,
            metric_value FLOAT NOT NULL,
            category VARCHAR(50),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_compliance_kpis_metric_key ON compliance_kpis(metric_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_compliance_kpis_category ON compliance_kpis(category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_compliance_kpis_timestamp ON compliance_kpis(timestamp)")


def _create_system_health_snapshots():
    op.execute("""
        CREATE TABLE IF NOT EXISTS system_health_snapshots (
            id TEXT PRIMARY KEY,
            availability_pct FLOAT DEFAULT 100.0,
            latency_p95_ms FLOAT DEFAULT 0.0,
            error_budget_burn FLOAT DEFAULT 0.0,
            sample_points INTEGER DEFAULT 0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_system_health_snapshots_timestamp ON system_health_snapshots(timestamp)")


def _create_ai_threat_logs():
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_threat_logs (
            id TEXT PRIMARY KEY,
            wallet_address VARCHAR(255) NOT NULL,
            threat_type VARCHAR(50) NOT NULL,
            risk_score FLOAT NOT NULL,
            details TEXT,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_threat_logs_wallet_address ON ai_threat_logs(wallet_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_threat_logs_threat_type ON ai_threat_logs(threat_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_threat_logs_detected_at ON ai_threat_logs(detected_at)")


def _create_usage_logs():
    op.execute("""
        CREATE TABLE IF NOT EXISTS usage_logs (
            id TEXT PRIMARY KEY,
            organization_id TEXT REFERENCES organizations(id),
            user_id TEXT REFERENCES users(id),
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(10) NOT NULL,
            status_code INTEGER,
            response_time_ms INTEGER,
            ip_address VARCHAR(45),
            user_agent TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_usage_logs_organization_id ON usage_logs(organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_usage_logs_user_id ON usage_logs(user_id)")


def _create_auth_sessions():
    op.execute("""
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            token_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_sessions_token_hash ON auth_sessions(token_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_auth_sessions_expires_at ON auth_sessions(expires_at)")


def _drop_organizations():
    op.execute("DROP TABLE IF EXISTS organizations")


def _drop_users():
    op.execute("DROP TABLE IF EXISTS users")


def _drop_wallets():
    op.execute("DROP TABLE IF EXISTS wallets")


def _drop_token_transfers():
    op.execute("DROP TABLE IF EXISTS token_transfers")


def _drop_transactions():
    op.execute("DROP TABLE IF EXISTS transactions")


def _drop_risk_assessments():
    op.execute("DROP TABLE IF EXISTS risk_assessments")


def _drop_blacklist():
    op.execute("DROP TABLE IF EXISTS blacklist")


def _drop_alerts():
    op.execute("DROP TABLE IF EXISTS alerts")


def _drop_blocked_transfers():
    op.execute("DROP TABLE IF EXISTS blocked_transfers")


def _drop_user_warnings():
    op.execute("DROP TABLE IF EXISTS user_warnings")


def _drop_audit_logs():
    op.execute("DROP TABLE IF EXISTS audit_logs")


def _drop_feedback_labels():
    op.execute("DROP TABLE IF EXISTS feedback_labels")


def _drop_transaction_cases():
    op.execute("DROP TABLE IF EXISTS transaction_cases")


def _drop_node_endpoints():
    op.execute("DROP TABLE IF EXISTS node_endpoints")


def _drop_pipeline_metrics():
    op.execute("DROP TABLE IF EXISTS pipeline_metrics")


def _drop_feature_store_configs():
    op.execute("DROP TABLE IF EXISTS feature_store_configs")


def _drop_model_registry():
    op.execute("DROP TABLE IF EXISTS model_registry")


def _drop_policy_rules():
    op.execute("DROP TABLE IF EXISTS policy_rules")


def _drop_notification_events():
    op.execute("DROP TABLE IF EXISTS notification_events")


def _drop_diagnostic_events():
    op.execute("DROP TABLE IF EXISTS diagnostic_events")


def _drop_money_flow_snapshots():
    op.execute("DROP TABLE IF EXISTS money_flow_snapshots")


def _drop_compliance_kpis():
    op.execute("DROP TABLE IF EXISTS compliance_kpis")


def _drop_system_health_snapshots():
    op.execute("DROP TABLE IF EXISTS system_health_snapshots")


def _drop_ai_threat_logs():
    op.execute("DROP TABLE IF EXISTS ai_threat_logs")


def _drop_usage_logs():
    op.execute("DROP TABLE IF EXISTS usage_logs")


def _drop_auth_sessions():
    op.execute("DROP TABLE IF EXISTS auth_sessions")
