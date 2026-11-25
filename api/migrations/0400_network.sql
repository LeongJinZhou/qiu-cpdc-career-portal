-- Slice 3b: alumni network and mentoring (docs/SPEC.md section 9).

-- One row per alumnus who opened the directory settings. Nothing is visible until visible = 1, and then only the
-- name (linked to LinkedIn) plus each field whose show_* flag is 1.
CREATE TABLE network_profile (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT 0,
    show_title BOOLEAN NOT NULL DEFAULT 0,
    show_company BOOLEAN NOT NULL DEFAULT 0,
    show_faculty BOOLEAN NOT NULL DEFAULT 0,
    show_year BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_network_profile_visible (organisation_id, visible),
    CONSTRAINT fk_network_profile_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_network_profile_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- An alumnus's mentoring offer. topics_json: list of up to 6 short topics.
CREATE TABLE mentor_offer (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    topics_json JSON NOT NULL,
    slots_per_month TINYINT UNSIGNED NOT NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_mentor_offer_active (organisation_id, active),
    CONSTRAINT ck_mentor_offer_slots CHECK (slots_per_month BETWEEN 1 AND 10),
    CONSTRAINT fk_mentor_offer_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_mentor_offer_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A student's request to a mentor. One open (waiting) request per student and mentor.
CREATE TABLE mentor_request (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    mentor_id BIGINT UNSIGNED NOT NULL,
    message VARCHAR(600) NOT NULL,
    status ENUM('waiting', 'accepted', 'declined', 'withdrawn') NOT NULL DEFAULT 'waiting',
    reply VARCHAR(600) NULL,
    created_at DATETIME(3) NOT NULL,
    decided_at DATETIME(3) NULL,
    waiting_guard TINYINT GENERATED ALWAYS AS (IF(status = 'waiting', 1, NULL)) STORED,
    UNIQUE KEY uq_mentor_request_waiting (student_id, mentor_id, waiting_guard),
    KEY ix_mentor_request_mentor (mentor_id, status, decided_at),
    KEY ix_mentor_request_org (organisation_id, created_at),
    CONSTRAINT fk_mentor_request_student FOREIGN KEY (student_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_mentor_request_mentor FOREIGN KEY (mentor_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_mentor_request_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
