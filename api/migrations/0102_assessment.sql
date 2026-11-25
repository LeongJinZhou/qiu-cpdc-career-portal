-- Slice 2a: short self-assessments (docs/SPEC.md section 9). CPDC writes single-choice questions with points per
-- option and result bands; the server scores every attempt. Questions are frozen once anyone has an attempt.

CREATE TABLE assessment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    -- [{"min_percent": 0-100, "label": "..."}], validated by shared/schemas/assessment.save.json
    bands_json JSON NOT NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_assessment_status (organisation_id, status),
    KEY ix_assessment_created_by (created_by),
    CONSTRAINT fk_assessment_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_assessment_created_by FOREIGN KEY (created_by) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assessment_question (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    assessment_id BIGINT UNSIGNED NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    prompt VARCHAR(500) NOT NULL,
    KEY ix_assessment_question_assessment (assessment_id, position),
    CONSTRAINT fk_assessment_question_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_assessment_question_assessment FOREIGN KEY (assessment_id) REFERENCES assessment (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assessment_option (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    label VARCHAR(300) NOT NULL,
    points TINYINT UNSIGNED NOT NULL,
    KEY ix_assessment_option_question (question_id, position),
    CONSTRAINT ck_assessment_option_points CHECK (points <= 10),
    CONSTRAINT fk_assessment_option_question FOREIGN KEY (question_id) REFERENCES assessment_question (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- score, max_score and band are worked out on the server when the attempt is saved.
CREATE TABLE assessment_attempt (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    assessment_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    score SMALLINT UNSIGNED NOT NULL,
    max_score SMALLINT UNSIGNED NOT NULL,
    band_label VARCHAR(80) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_assessment_attempt_user (user_id, created_at),
    KEY ix_assessment_attempt_assessment (assessment_id, created_at),
    CONSTRAINT fk_assessment_attempt_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_assessment_attempt_assessment FOREIGN KEY (assessment_id) REFERENCES assessment (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_assessment_attempt_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assessment_answer (
    attempt_id BIGINT UNSIGNED NOT NULL,
    question_id BIGINT UNSIGNED NOT NULL,
    option_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (attempt_id, question_id),
    KEY ix_assessment_answer_question (question_id),
    KEY ix_assessment_answer_option (option_id),
    CONSTRAINT fk_assessment_answer_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempt (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_assessment_answer_question FOREIGN KEY (question_id) REFERENCES assessment_question (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_assessment_answer_option FOREIGN KEY (option_id) REFERENCES assessment_option (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
