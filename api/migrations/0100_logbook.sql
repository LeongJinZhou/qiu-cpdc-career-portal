-- Slice 2a: internship logbook (docs/SPEC.md section 9). The industry supervisor has no login: they approve or
-- return a week through a single-use link. Only the SHA-256 of the link's secret is stored.

CREATE TABLE internship (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    company VARCHAR(200) NOT NULL,
    supervisor_name VARCHAR(200) NOT NULL,
    supervisor_email VARCHAR(254) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_internship_student (student_id),
    KEY ix_internship_org (organisation_id, start_date),
    CONSTRAINT ck_internship_dates CHECK (end_date >= start_date),
    CONSTRAINT fk_internship_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_internship_student FOREIGN KEY (student_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One entry per internship week; week_start is the Monday of that week.
CREATE TABLE logbook_entry (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    internship_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    week_start DATE NOT NULL,
    hours SMALLINT UNSIGNED NOT NULL,
    activities TEXT NOT NULL,
    learnings TEXT NOT NULL,
    status ENUM('draft', 'submitted', 'approved', 'returned') NOT NULL DEFAULT 'draft',
    supervisor_comment TEXT NULL,
    submitted_at DATETIME(3) NULL,
    decided_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_logbook_entry_week (internship_id, week_start),
    KEY ix_logbook_entry_student (student_id, week_start),
    KEY ix_logbook_entry_status (organisation_id, status),
    CONSTRAINT ck_logbook_entry_hours CHECK (hours <= 80),
    CONSTRAINT fk_logbook_entry_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_logbook_entry_internship FOREIGN KEY (internship_id) REFERENCES internship (id) ON DELETE CASCADE,
    CONSTRAINT fk_logbook_entry_student FOREIGN KEY (student_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A review link: token_hash = SHA-256 of the 43-character secret in the emailed URL. used_at set = spent.
CREATE TABLE logbook_review_link (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    entry_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    supervisor_email VARCHAR(254) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_logbook_review_link_token (token_hash),
    KEY ix_logbook_review_link_entry (entry_id, used_at),
    CONSTRAINT fk_logbook_review_link_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_logbook_review_link_entry FOREIGN KEY (entry_id) REFERENCES logbook_entry (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
