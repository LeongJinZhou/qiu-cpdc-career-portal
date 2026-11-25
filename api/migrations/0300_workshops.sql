-- Workshops and events with RSVP, waitlist and check-in (slice 3a). Times are UTC; the screens show Malaysia time.

CREATE TABLE workshop (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    starts_at DATETIME(3) NOT NULL,
    ends_at DATETIME(3) NOT NULL,
    mode ENUM('in_person', 'online') NOT NULL,
    venue VARCHAR(200) NULL,
    online_url VARCHAR(500) NULL,
    capacity INT UNSIGNED NOT NULL,
    -- Who may RSVP: any of student, staff, alumni (admins count as staff).
    audience SET('student', 'staff', 'alumni') NOT NULL,
    -- Shown on screen at the venue; attendees type it to check themselves in.
    checkin_code CHAR(6) NOT NULL,
    status ENUM('published', 'cancelled') NOT NULL DEFAULT 'published',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_workshop_starts (organisation_id, status, starts_at),
    KEY ix_workshop_created_by (created_by),
    CONSTRAINT ck_workshop_times CHECK (ends_at > starts_at),
    CONSTRAINT ck_workshop_capacity CHECK (capacity BETWEEN 1 AND 5000),
    CONSTRAINT ck_workshop_place CHECK (
        (mode = 'in_person' AND venue IS NOT NULL) OR (mode = 'online' AND online_url IS NOT NULL)
    ),
    CONSTRAINT fk_workshop_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_workshop_created_by FOREIGN KEY (created_by) REFERENCES `user` (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workshop_rsvp (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workshop_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status ENUM('going', 'waitlist', 'cancelled') NOT NULL,
    -- Waitlist order: the time of the latest RSVP (a cancelled RSVP that comes back joins at the end).
    queued_at DATETIME(3) NOT NULL,
    checked_in_at DATETIME(3) NULL,
    checked_in_by BIGINT UNSIGNED NULL,
    checkin_method ENUM('code', 'list') NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_workshop_rsvp (workshop_id, user_id),
    KEY ix_workshop_rsvp_queue (workshop_id, status, queued_at),
    KEY ix_workshop_rsvp_user (user_id),
    KEY ix_workshop_rsvp_checked_by (checked_in_by),
    CONSTRAINT fk_workshop_rsvp_workshop FOREIGN KEY (workshop_id) REFERENCES workshop (id) ON DELETE CASCADE,
    CONSTRAINT fk_workshop_rsvp_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_workshop_rsvp_checked_by FOREIGN KEY (checked_in_by) REFERENCES `user` (id) ON DELETE SET NULL,
    CONSTRAINT fk_workshop_rsvp_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
