-- Slice 2b: employers and jobs with applications, skills self-rating with a gap view, learning records
-- (docs/SPEC.md section 6, slice 2b).

CREATE TABLE employer (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    industry VARCHAR(200) NULL,
    website VARCHAR(300) NULL,
    location VARCHAR(200) NULL,
    about TEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_employer_name (organisation_id, name),
    CONSTRAINT fk_employer_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The areas people rate themselves in, and that a job can ask for. CPDC's list, per organisation.
CREATE TABLE skill_area (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(300) NOT NULL,
    position SMALLINT NOT NULL,
    UNIQUE KEY uq_skill_area_name (organisation_id, name),
    KEY ix_skill_area_position (organisation_id, position),
    CONSTRAINT fk_skill_area_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_posting (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    employer_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    job_type ENUM('full_time', 'part_time', 'internship', 'contract') NOT NULL,
    location VARCHAR(200) NOT NULL,
    closing_date DATE NOT NULL,
    description TEXT NOT NULL,
    status ENUM('draft', 'open', 'closed') NOT NULL DEFAULT 'open',
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_job_posting_browse (organisation_id, status, closing_date),
    KEY ix_job_posting_employer (employer_id),
    CONSTRAINT fk_job_posting_employer FOREIGN KEY (employer_id) REFERENCES employer (id),
    CONSTRAINT fk_job_posting_created_by FOREIGN KEY (created_by) REFERENCES `user` (id) ON DELETE SET NULL,
    CONSTRAINT fk_job_posting_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The level (1-5) a job asks for in a skill area; the gap view compares it with the person's latest rating.
CREATE TABLE job_skill (
    job_id BIGINT UNSIGNED NOT NULL,
    area_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    level TINYINT NOT NULL,
    PRIMARY KEY (job_id, area_id),
    KEY ix_job_skill_area (area_id),
    CONSTRAINT ck_job_skill_level CHECK (level BETWEEN 1 AND 5),
    CONSTRAINT fk_job_skill_job FOREIGN KEY (job_id) REFERENCES job_posting (id) ON DELETE CASCADE,
    CONSTRAINT fk_job_skill_area FOREIGN KEY (area_id) REFERENCES skill_area (id),
    CONSTRAINT fk_job_skill_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One application per person per job. cv_file is the random name of the stored PDF (never the client's name).
CREATE TABLE job_application (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    job_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    note TEXT NULL,
    cv_file CHAR(32) NULL,
    cv_name VARCHAR(200) NULL,
    cv_size INT UNSIGNED NULL,
    status ENUM('submitted', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected', 'withdrawn')
        NOT NULL DEFAULT 'submitted',
    status_changed_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_job_application_person (job_id, user_id),
    UNIQUE KEY uq_job_application_cv (cv_file),
    KEY ix_job_application_user (user_id, created_at),
    KEY ix_job_application_job (organisation_id, job_id, status),
    CONSTRAINT fk_job_application_job FOREIGN KEY (job_id) REFERENCES job_posting (id),
    CONSTRAINT fk_job_application_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_job_application_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A self-rating is saved as a whole each time, so progress over time can be shown.
CREATE TABLE skill_assessment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL,
    KEY ix_skill_assessment_user (user_id, created_at),
    CONSTRAINT fk_skill_assessment_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_skill_assessment_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE skill_rating (
    assessment_id BIGINT UNSIGNED NOT NULL,
    area_id BIGINT UNSIGNED NOT NULL,
    level TINYINT NOT NULL,
    PRIMARY KEY (assessment_id, area_id),
    KEY ix_skill_rating_area (area_id),
    CONSTRAINT ck_skill_rating_level CHECK (level BETWEEN 1 AND 5),
    CONSTRAINT fk_skill_rating_assessment FOREIGN KEY (assessment_id) REFERENCES skill_assessment (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_skill_rating_area FOREIGN KEY (area_id) REFERENCES skill_area (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A course or certificate the person finished, with a link or a PDF proof (or both); CPDC verifies it.
CREATE TABLE learning_record (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('course', 'certificate') NOT NULL,
    name VARCHAR(200) NOT NULL,
    provider VARCHAR(200) NOT NULL,
    completed_on DATE NOT NULL,
    link_url VARCHAR(500) NULL,
    proof_file CHAR(32) NULL,
    proof_name VARCHAR(200) NULL,
    status ENUM('submitted', 'verified', 'rejected') NOT NULL DEFAULT 'submitted',
    review_note VARCHAR(500) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_learning_record_proof (proof_file),
    KEY ix_learning_record_user (user_id, completed_on),
    KEY ix_learning_record_review (organisation_id, status, created_at),
    CONSTRAINT ck_learning_record_evidence CHECK (link_url IS NOT NULL OR proof_file IS NOT NULL),
    CONSTRAINT fk_learning_record_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_learning_record_reviewer FOREIGN KEY (reviewed_by) REFERENCES `user` (id) ON DELETE SET NULL,
    CONSTRAINT fk_learning_record_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
