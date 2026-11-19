-- Everything set on the Trip tab, so it is shared with the crew and survives a reload.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_date DATE;
-- An https URL or an image data URL. NULL shows the default picture.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS image TEXT;
-- [{ "crewId": "...", "limitMinutes": 240 }]
ALTER TABLE trips ADD COLUMN IF NOT EXISTS drivers JSONB NOT NULL DEFAULT '[]';
-- Crew members without an account, added by name on the Trip tab: [{ "id": "crew-...", "name": "Ava" }]
ALTER TABLE trips ADD COLUMN IF NOT EXISTS guests JSONB NOT NULL DEFAULT '[]';

-- A stop typed without picking a suggestion has no location yet.
ALTER TABLE waypoints ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE waypoints ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('start', 'end'));
ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS waypoints_trip_role_key ON waypoints (trip_id, role) WHERE role IS NOT NULL;

CREATE TABLE IF NOT EXISTS waypoint_votes (
  waypoint_id UUID NOT NULL REFERENCES waypoints (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  PRIMARY KEY (waypoint_id, user_id)
);
