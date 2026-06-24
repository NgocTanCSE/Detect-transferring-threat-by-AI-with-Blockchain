/*
  Migration: add user_details and user_preferences tables
  Provides persistent storage for extended profile information and notification settings.
*/

-- Table: user_details
CREATE TABLE IF NOT EXISTS user_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(200),
    phone VARCHAR(30),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_details_user ON user_details(user_id);

-- Table: user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dark_mode BOOLEAN DEFAULT FALSE,
    language VARCHAR(10) DEFAULT 'en',
    notif_email BOOLEAN DEFAULT TRUE,
    notif_push BOOLEAN DEFAULT FALSE,
    notif_sms BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- Optional demo seed (only inserts if rows do not exist)
INSERT INTO user_details (user_id, full_name, phone, address)
SELECT id, 'Demo User', '+84 123456789', 'Hanoi, Vietnam'
FROM users WHERE username = 'admin_security'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_preferences (user_id, dark_mode, language, notif_email, notif_push, notif_sms)
SELECT id, TRUE, 'vi', TRUE, FALSE, FALSE
FROM users WHERE username = 'admin_security'
ON CONFLICT (user_id) DO NOTHING;
