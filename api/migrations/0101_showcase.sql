-- Slice 2a: final-year project showcase and talent feed (docs/SPEC.md section 9). One project per student.
-- The image file lives in STORAGE_DIR/showcase under a server-made name; image_name holds that name only.

CREATE TABLE showcase_project (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    summary TEXT NOT NULL,
    faculty VARCHAR(200) NULL,
    project_year SMALLINT NOT NULL,
    repo_url VARCHAR(500) NULL,
    demo_url VARCHAR(500) NULL,
    image_name VARCHAR(40) NULL,
    image_type VARCHAR(20) NULL,
    published BOOLEAN NOT NULL DEFAULT 0,
    published_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uq_showcase_project_student (student_id),
    KEY ix_showcase_project_feed (organisation_id, published, published_at),
    KEY ix_showcase_project_filter (organisation_id, faculty, project_year),
    CONSTRAINT ck_showcase_project_year CHECK (project_year BETWEEN 1990 AND 2100),
    CONSTRAINT fk_showcase_project_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_showcase_project_student FOREIGN KEY (student_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE showcase_tech (
    project_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    tech VARCHAR(40) NOT NULL,
    PRIMARY KEY (project_id, tech),
    KEY ix_showcase_tech_filter (organisation_id, tech),
    CONSTRAINT fk_showcase_tech_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id),
    CONSTRAINT fk_showcase_tech_project FOREIGN KEY (project_id) REFERENCES showcase_project (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
