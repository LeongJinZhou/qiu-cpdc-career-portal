-- Career profile, LinkedIn and GitHub links, alumni tracking (docs/SPEC.md section 6).

CREATE TABLE linkedin_account (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    linkedin_sub VARCHAR(64) NOT NULL,
    name VARCHAR(200) NULL,
    profile_url VARCHAR(300) NULL,
    follow_confirmed_at DATETIME(3) NULL,
    linked_at DATETIME(3) NOT NULL,
    last_sign_in_at DATETIME(3) NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_linkedin_sub (organisation_id, linkedin_sub),
    CONSTRAINT fk_linkedin_account_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_linkedin_account_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE github_account (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    github_id VARCHAR(32) NOT NULL,
    login VARCHAR(100) NOT NULL,
    profile_url VARCHAR(300) NOT NULL,
    linked_at DATETIME(3) NOT NULL,
    UNIQUE KEY uq_github_id (organisation_id, github_id),
    CONSTRAINT fk_github_account_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_github_account_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE career_profile (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    headline VARCHAR(300) NULL,
    about TEXT NULL,
    location VARCHAR(200) NULL,
    industry VARCHAR(200) NULL,
    personal_email VARCHAR(254) NULL,
    faculty VARCHAR(200) NULL,
    programme VARCHAR(200) NULL,
    graduation_year SMALLINT NULL,
    employment_status ENUM('employed', 'self_employed', 'further_study', 'seeking', 'not_seeking', 'unknown')
        NOT NULL DEFAULT 'unknown',
    current_title VARCHAR(200) NULL,
    current_company VARCHAR(200) NULL,
    current_since DATE NULL,
    job_confirmed_at DATETIME(3) NULL,
    last_pdf_import_at DATETIME(3) NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_career_profile_tracker (organisation_id, faculty, graduation_year, employment_status),
    KEY ix_career_profile_confirmed (organisation_id, job_confirmed_at),
    -- The QIU address closes at graduation: never the personal email (SPEC rule 15).
    CONSTRAINT ck_career_profile_personal_email CHECK (
        personal_email IS NULL OR LOWER(personal_email) NOT LIKE '%qiu.edu.my'
    ),
    CONSTRAINT ck_career_profile_year CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1990 AND 2100),
    CONSTRAINT fk_career_profile_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_profile_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_confirmation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    employment_status ENUM('employed', 'self_employed', 'further_study', 'seeking', 'not_seeking', 'unknown')
        NOT NULL,
    title VARCHAR(200) NULL,
    company VARCHAR(200) NULL,
    confirmed_at DATETIME(3) NOT NULL,
    KEY ix_job_confirmation_org (organisation_id, confirmed_at),
    KEY ix_job_confirmation_user (user_id, confirmed_at),
    CONSTRAINT fk_job_confirmation_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_job_confirmation_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE career_experience (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    location VARCHAR(200) NULL,
    start_month DATE NULL,
    end_month DATE NULL,
    description TEXT NULL,
    source ENUM('pdf', 'manual') NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_career_experience_user (user_id, position),
    CONSTRAINT fk_career_experience_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_experience_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE career_education (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    school VARCHAR(200) NOT NULL,
    degree VARCHAR(200) NULL,
    field VARCHAR(200) NULL,
    start_year SMALLINT NULL,
    end_year SMALLINT NULL,
    source ENUM('pdf', 'manual') NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    KEY ix_career_education_user (user_id, position),
    CONSTRAINT fk_career_education_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_education_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE career_skill (
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    skill VARCHAR(80) NOT NULL,
    PRIMARY KEY (user_id, skill),
    KEY ix_career_skill_org (organisation_id, skill),
    CONSTRAINT fk_career_skill_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_skill_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE graduate_registration (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    matric_no VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    programme VARCHAR(200) NOT NULL,
    faculty VARCHAR(200) NULL,
    graduation_year SMALLINT NOT NULL,
    matched_user_id BIGINT UNSIGNED NULL,
    status ENUM('waiting', 'approved', 'refused') NOT NULL DEFAULT 'waiting',
    decided_by BIGINT UNSIGNED NULL,
    decided_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    -- One waiting registration per user.
    waiting_guard TINYINT GENERATED ALWAYS AS (IF(status = 'waiting', 1, NULL)) STORED,
    UNIQUE KEY uq_graduate_registration_waiting (user_id, waiting_guard),
    KEY ix_graduate_registration_status (organisation_id, status, created_at),
    KEY ix_graduate_registration_matric (organisation_id, matric_no),
    KEY ix_graduate_registration_matched (matched_user_id),
    KEY ix_graduate_registration_decided_by (decided_by),
    CONSTRAINT ck_graduate_registration_year CHECK (graduation_year BETWEEN 1990 AND 2100),
    CONSTRAINT fk_graduate_registration_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE SET NULL,
    CONSTRAINT fk_graduate_registration_matched FOREIGN KEY (matched_user_id) REFERENCES `user` (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_graduate_registration_decided_by FOREIGN KEY (decided_by) REFERENCES `user` (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_graduate_registration_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
