-- ZenCart D1 Database Schema
-- Tables are project-specific and prefixed with zencart_
-- Uses CREATE TABLE IF NOT EXISTS to be safe for re-runs

-- Anonymous quiz submissions
CREATE TABLE IF NOT EXISTS zencart_quiz_submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  pet_choice     TEXT,
  color_choice   TEXT,
  gender         TEXT,
  age_group      TEXT,
  stress_source  TEXT,
  budget_tier    TEXT,
  keywords_shown TEXT,   -- JSON array of keyword strings returned
  created_at     INTEGER DEFAULT (unixepoch())
);

-- Page view log
CREATE TABLE IF NOT EXISTS zencart_page_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page       TEXT NOT NULL,
  referrer   TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- User reviews
CREATE TABLE IF NOT EXISTS zencart_reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT,
  stars        INTEGER CHECK(stars BETWEEN 1 AND 5),
  comment      TEXT,
  display_name TEXT,
  approved     INTEGER DEFAULT 1,
  created_at   INTEGER DEFAULT (unixepoch())
);

-- Editable config (keyword matrix, etc.)
CREATE TABLE IF NOT EXISTS zencart_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);
