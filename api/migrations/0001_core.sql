-- Core tables (docs/SPEC.md section 6). Times are UTC DATETIME(3) from the server clock.
-- Statements end with ";" at line end.

CREATE TABLE organisation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO organisation (id, name) VALUES (1, 'Quest International University');

CREATE TABLE `user` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    google_sub VARCHAR(64) NULL,
    email VARCHAR(254) NULL,
    display_name VARCHAR(200) NOT NULL,
    picture_url VARCHAR(500) NULL,
    matric_no VARCHAR(64) NULL,
    employee_id VARCHAR(64) NULL,
    employee_type VARCHAR(64) NULL,
    department VARCHAR(200) NULL,
    job_title VARCHAR(200) NULL,
    role ENUM('superadmin', 'admin', 'staff', 'student', 'alumni', 'pending') NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    onboarded_at DATETIME(3) NULL,
    consent_at DATETIME(3) NULL,
    consent_version VARCHAR(20) NULL,
    alumni_since DATETIME(3) NULL,
    last_sign_in_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    -- NULL for every other role, so the unique key below allows exactly one superadmin per organisation.
    superadmin_guard TINYINT GENERATED ALWAYS AS (IF(role = 'superadmin', 1, NULL)) STORED,
    UNIQUE KEY uq_user_sub (organisation_id, google_sub),
    UNIQUE KEY uq_user_email (organisation_id, email),
    UNIQUE KEY uq_user_matric (organisation_id, matric_no),
    UNIQUE KEY uq_user_superadmin (organisation_id, superadmin_guard),
    KEY ix_user_role (organisation_id, role),
    KEY ix_user_department (organisation_id, department),
    CONSTRAINT ck_user_email CHECK (email IS NOT NULL OR role IN ('pending', 'alumni')),
    CONSTRAINT fk_user_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- role is a base role (user.role) or an extra role key (user_role_grant.role_key), so VARCHAR, not ENUM.
CREATE TABLE role_permission (
    organisation_id BIGINT UNSIGNED NOT NULL,
    role VARCHAR(40) NOT NULL,
    permission VARCHAR(50) NOT NULL,
    scope ENUM('all', 'assigned', 'own') NOT NULL,
    PRIMARY KEY (organisation_id, role, permission),
    CONSTRAINT fk_role_permission_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_role_grant (
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role_key VARCHAR(40) NOT NULL,
    granted_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (user_id, role_key),
    KEY ix_user_role_grant_org (organisation_id, role_key),
    KEY ix_user_role_grant_by (granted_by),
    CONSTRAINT fk_user_role_grant_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_user_role_grant_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_role_grant_by FOREIGN KEY (granted_by) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    provider ENUM('google', 'linkedin') NOT NULL,
    email VARCHAR(254) NULL,
    linkedin_sub VARCHAR(64) NULL,
    result VARCHAR(40) NOT NULL,
    ip VARBINARY(16) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_login_log_created (organisation_id, created_at),
    KEY ix_login_log_user (user_id),
    CONSTRAINT fk_login_log_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_login_log_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    target VARCHAR(120) NOT NULL,
    meta_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_audit_log_created (organisation_id, created_at),
    KEY ix_audit_log_actor (actor_id),
    KEY ix_audit_log_target (organisation_id, target),
    CONSTRAINT fk_audit_log_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_audit_log_actor FOREIGN KEY (actor_id) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- value NULL = not configured yet; Settings refuses to read it (fail closed).
CREATE TABLE setting (
    organisation_id BIGINT UNSIGNED NOT NULL,
    setting_key VARCHAR(60) NOT NULL,
    value JSON NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (organisation_id, setting_key),
    KEY ix_setting_updated_by (updated_by),
    CONSTRAINT fk_setting_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_setting_updated_by FOREIGN KEY (updated_by) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Not owned data (bucket = sha256 of limiter name + IP or user id), so no organisation_id.
CREATE TABLE rate_limit (
    bucket CHAR(64) NOT NULL,
    window_start DATETIME NOT NULL,
    count INT UNSIGNED NOT NULL,
    PRIMARY KEY (bucket, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
