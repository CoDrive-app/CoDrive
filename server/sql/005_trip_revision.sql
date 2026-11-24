-- Goes up by one with every change to a trip, its stops, votes, expenses or crew, so the app can tell when to reload it.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;
