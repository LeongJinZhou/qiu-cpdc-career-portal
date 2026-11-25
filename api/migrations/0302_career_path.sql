-- Career paths by programme (slice 3a): target roles with skills and steps, written by CPDC; each person ticks the
-- steps they have done.

CREATE TABLE career_path (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    programme VARCHAR(200) NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(2000) NULL,
    -- List of skill names (strings), validated by shared/schemas/career-path.save.json.
    skills_json JSON NOT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_career_path_programme (organisation_id, programme),
    KEY ix_career_path_created_by (created_by),
    CONSTRAINT fk_career_path_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_career_path_created_by FOREIGN KEY (created_by) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE career_path_step (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    path_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    detail VARCHAR(1000) NULL,
    position SMALLINT UNSIGNED NOT NULL,
    KEY ix_career_path_step_path (path_id, position),
    CONSTRAINT fk_career_path_step_path FOREIGN KEY (path_id) REFERENCES career_path (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_path_step_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE career_path_progress (
    user_id BIGINT UNSIGNED NOT NULL,
    step_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    done_at DATETIME(3) NOT NULL,
    PRIMARY KEY (user_id, step_id),
    KEY ix_career_path_progress_step (step_id),
    CONSTRAINT fk_career_path_progress_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_path_progress_step FOREIGN KEY (step_id) REFERENCES career_path_step (id) ON DELETE CASCADE,
    CONSTRAINT fk_career_path_progress_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
