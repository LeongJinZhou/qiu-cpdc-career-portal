-- Slice 3b: interview practice with AI feedback (docs/SPEC.md section 9).

-- The question bank CPDC keeps, by field. Questions are switched off, never deleted, so old sessions keep meaning.
CREATE TABLE interview_question (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    field VARCHAR(80) NOT NULL,
    question VARCHAR(500) NOT NULL,
    tip VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_interview_question_field (organisation_id, field, active),
    CONSTRAINT fk_interview_question_creator FOREIGN KEY (created_by) REFERENCES `user` (id) ON DELETE SET NULL,
    CONSTRAINT fk_interview_question_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE interview_session (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    field VARCHAR(80) NOT NULL,
    started_at DATETIME(3) NOT NULL,
    KEY ix_interview_session_user (user_id, started_at),
    CONSTRAINT fk_interview_session_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_interview_session_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One question of a session, copied at the start (the bank may change later), with the answer and the feedback.
-- feedback_json: {score 1-5, summary, strengths[], improve[]} from the AI driver named in ai_driver.
CREATE TABLE interview_item (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    question_id BIGINT UNSIGNED NULL,
    question VARCHAR(500) NOT NULL,
    tip VARCHAR(500) NULL,
    answer TEXT NULL,
    feedback_json JSON NULL,
    ai_driver VARCHAR(20) NULL,
    answered_at DATETIME(3) NULL,
    UNIQUE KEY uq_interview_item_position (session_id, position),
    KEY ix_interview_item_user_answered (user_id, answered_at),
    CONSTRAINT fk_interview_item_session FOREIGN KEY (session_id) REFERENCES interview_session (id) ON DELETE CASCADE,
    CONSTRAINT fk_interview_item_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_interview_item_question FOREIGN KEY (question_id) REFERENCES interview_question (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_interview_item_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
