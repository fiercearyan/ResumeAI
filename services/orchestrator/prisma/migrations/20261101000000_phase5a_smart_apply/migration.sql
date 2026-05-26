-- Phase 5a: Smart Apply
--
-- Extends profiles with the new auto-fill source fields, adds three new
-- tables (saved_answers, field_mappings, application_questionnaires).
-- All adds are NULLable / DEFAULTed so the migration is safe to apply on a
-- populated production DB.

ALTER TABLE "profiles"
  ADD COLUMN "linkedin_headline"    TEXT,
  ADD COLUMN "years_of_experience"  DOUBLE PRECISION,
  ADD COLUMN "current_company"      TEXT,
  ADD COLUMN "notice_period"        TEXT,
  ADD COLUMN "current_salary"       TEXT,
  ADD COLUMN "expected_salary"      TEXT,
  ADD COLUMN "work_auth"            TEXT,
  ADD COLUMN "requires_sponsorship" BOOLEAN,
  ADD COLUMN "preferred_location"   TEXT,
  ADD COLUMN "gender"               TEXT,
  ADD COLUMN "race"                 TEXT,
  ADD COLUMN "veteran_status"       TEXT,
  ADD COLUMN "disability_status"    TEXT;

CREATE TABLE "saved_answers" (
  "user_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "question_key"  TEXT NOT NULL,
  "question_text" TEXT NOT NULL,
  "answer_text"   TEXT NOT NULL,
  "source"        TEXT NOT NULL DEFAULT 'user',
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "question_key")
);
CREATE INDEX "saved_answers_user_id_updated_at_idx"
  ON "saved_answers" ("user_id", "updated_at" DESC);

CREATE TABLE "field_mappings" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label_pattern" TEXT NOT NULL UNIQUE,
  "profile_field" TEXT NOT NULL,
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  "source"        TEXT NOT NULL DEFAULT 'seed',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "field_mappings_profile_field_idx"
  ON "field_mappings" ("profile_field");

CREATE TABLE "application_questionnaires" (
  "application_id" UUID PRIMARY KEY REFERENCES "applications"("id") ON DELETE CASCADE,
  "payload"        JSONB NOT NULL,
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the field_mappings synonym table with ~60 common Greenhouse labels.
-- profile_field values are dot-paths the mapping engine knows how to resolve
-- (e.g. "profile.full_name", "profile.linkedin_url", "user.email") or
-- "saved_answer" for questions that need a saved answer rather than a profile
-- field.
INSERT INTO "field_mappings" ("label_pattern", "profile_field", "confidence", "source") VALUES
  -- Identity
  ('first name',                          'profile.first_name',         1.0, 'seed'),
  ('last name',                           'profile.last_name',          1.0, 'seed'),
  ('full name',                           'profile.full_name',          1.0, 'seed'),
  ('name',                                'profile.full_name',          0.85, 'seed'),
  ('preferred name',                      'profile.first_name',         0.85, 'seed'),
  ('email',                               'user.email',                 1.0, 'seed'),
  ('email address',                       'user.email',                 1.0, 'seed'),
  ('phone',                               'profile.phone',              1.0, 'seed'),
  ('phone number',                        'profile.phone',              1.0, 'seed'),
  ('mobile',                              'profile.phone',              0.95, 'seed'),
  -- Location
  ('location',                            'profile.current_location',   1.0, 'seed'),
  ('current location',                    'profile.current_location',   1.0, 'seed'),
  ('city',                                'profile.current_location',   0.9, 'seed'),
  ('location city',                       'profile.current_location',   0.95, 'seed'),
  ('preferred location',                  'profile.preferred_location', 1.0, 'seed'),
  ('preferred work location',             'profile.preferred_location', 0.95, 'seed'),
  -- Links
  ('linkedin',                            'profile.linkedin_url',       1.0, 'seed'),
  ('linkedin profile',                    'profile.linkedin_url',       1.0, 'seed'),
  ('linkedin url',                        'profile.linkedin_url',       1.0, 'seed'),
  ('github',                              'profile.github_url',         1.0, 'seed'),
  ('github profile',                      'profile.github_url',         1.0, 'seed'),
  ('github url',                          'profile.github_url',         1.0, 'seed'),
  ('portfolio',                           'profile.portfolio_url',      1.0, 'seed'),
  ('portfolio url',                       'profile.portfolio_url',      1.0, 'seed'),
  ('website',                             'profile.portfolio_url',      0.9, 'seed'),
  ('personal website',                    'profile.portfolio_url',      1.0, 'seed'),
  -- Career
  ('current company',                     'profile.current_company',    1.0, 'seed'),
  ('company',                             'profile.current_company',    0.85, 'seed'),
  ('current employer',                    'profile.current_company',    0.95, 'seed'),
  ('current title',                       'profile.job_title',          1.0, 'seed'),
  ('current job title',                   'profile.job_title',          1.0, 'seed'),
  ('job title',                           'profile.job_title',          0.95, 'seed'),
  ('linkedin headline',                   'profile.linkedin_headline',  1.0, 'seed'),
  ('headline',                            'profile.linkedin_headline',  0.9, 'seed'),
  ('years of experience',                 'profile.years_of_experience',1.0, 'seed'),
  ('total experience',                    'profile.years_of_experience',0.95, 'seed'),
  ('years of relevant experience',        'profile.years_of_experience',0.9, 'seed'),
  -- Compensation
  ('current salary',                      'profile.current_salary',     1.0, 'seed'),
  ('current ctc',                         'profile.current_salary',     1.0, 'seed'),
  ('current compensation',                'profile.current_salary',     0.95, 'seed'),
  ('expected salary',                     'profile.expected_salary',    1.0, 'seed'),
  ('expected ctc',                        'profile.expected_salary',    1.0, 'seed'),
  ('salary expectations',                 'profile.expected_salary',    1.0, 'seed'),
  ('desired compensation',                'profile.expected_salary',    0.95, 'seed'),
  ('compensation expectations',           'profile.expected_salary',    0.95, 'seed'),
  ('notice period',                       'profile.notice_period',      1.0, 'seed'),
  ('how soon can you start',              'profile.notice_period',      0.9, 'seed'),
  ('earliest start date',                 'profile.notice_period',      0.85, 'seed'),
  -- Work authorization
  ('are you authorized to work in the us','profile.work_auth',          1.0, 'seed'),
  ('are you legally authorized to work',  'profile.work_auth',          0.95, 'seed'),
  ('work authorization',                  'profile.work_auth',          1.0, 'seed'),
  ('authorized to work',                  'profile.work_auth',          0.9, 'seed'),
  ('do you require sponsorship',          'profile.requires_sponsorship',1.0, 'seed'),
  ('require sponsorship',                 'profile.requires_sponsorship',1.0, 'seed'),
  ('visa sponsorship',                    'profile.requires_sponsorship',1.0, 'seed'),
  ('require visa sponsorship',            'profile.requires_sponsorship',1.0, 'seed'),
  ('will you now or in the future require sponsorship',
                                          'profile.requires_sponsorship',1.0, 'seed'),
  -- Demographics (optional)
  ('gender',                              'profile.gender',             1.0, 'seed'),
  ('race',                                'profile.race',               1.0, 'seed'),
  ('ethnicity',                           'profile.race',               0.95, 'seed'),
  ('veteran',                             'profile.veteran_status',     1.0, 'seed'),
  ('veteran status',                      'profile.veteran_status',     1.0, 'seed'),
  ('disability',                          'profile.disability_status',  1.0, 'seed'),
  ('disability status',                   'profile.disability_status',  1.0, 'seed'),
  -- Resume
  ('resume',                              'profile.resume',             1.0, 'seed'),
  ('cv',                                  'profile.resume',             0.95, 'seed'),
  ('resume cv',                           'profile.resume',             1.0, 'seed'),
  ('upload resume',                       'profile.resume',             1.0, 'seed');
