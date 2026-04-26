-- Re-seed core administrative users
INSERT INTO users (id, username, email, password_hash, role, is_active)
VALUES 
(1, 'admin_security', 'admin@security.local', 'demo123', 'admin', true),
(2, 'analyst_01', 'analyst01@security.local', 'demo123', 'analyst', true)
ON CONFLICT (username) DO UPDATE SET password_hash = 'demo123';
