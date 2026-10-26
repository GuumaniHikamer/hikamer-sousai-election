CREATE TABLE IF NOT EXISTS daily_votes(vote_day TEXT NOT NULL,ip_hash TEXT NOT NULL,candidate_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),PRIMARY KEY(vote_day,ip_hash));
CREATE TABLE IF NOT EXISTS vote_totals(candidate_id TEXT PRIMARY KEY,votes INTEGER NOT NULL DEFAULT 0 CHECK(votes>=0));
INSERT OR IGNORE INTO vote_totals(candidate_id,votes) VALUES
('all_mania',0),
('death_oyster',0),
('cocacola_fridge',0),
('chaimania',0),
('mugcup_mania',0),
('nyn_aniki2',0),
('tsuru_mania',0),
('shigaraki_kun',0),
('konmania',0),
('gunmania',0),
('bun_sushi',0),
('phony_mania',0),
('cross_mania',0),
('kohachi_mania',0);
