-- Re-seed core administrative users
INSERT INTO users (id, username, email, password_hash, role, is_active)
VALUES 
(1, 'admin_security', 'admin@security.local', '$2a$10$ftkyb3qFOAcxig/amhSAbu87/ij3fy89VAmcMHHqaUBg0zr/FtAeG', 'admin', true),
(2, 'analyst_01', 'analyst01@security.local', '$2a$10$ftkyb3qFOAcxig/amhSAbu87/ij3fy89VAmcMHHqaUBg0zr/FtAeG', 'analyst', true)
ON CONFLICT (username) DO UPDATE SET password_hash = '$2a$10$ftkyb3qFOAcxig/amhSAbu87/ij3fy89VAmcMHHqaUBg0zr/FtAeG';
