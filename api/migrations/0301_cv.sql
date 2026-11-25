-- CV builder (slice 3a): one CV per person. Jobs, education and skills come live from the career profile; this row
-- holds only what the CV adds (contact line, summary, extra sections) and which profile entries it leaves out.

CREATE TABLE cv_document (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    -- Validated by shared/schemas/cv.save.json before it is stored; the screen renders it as text only.
    content_json JSON NOT NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    KEY ix_cv_document_organisation (organisation_id),
    CONSTRAINT fk_cv_document_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
    CONSTRAINT fk_cv_document_organisation FOREIGN KEY (organisation_id) REFERENCES organisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
