CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  share_code TEXT NOT NULL UNIQUE,
  budget NUMERIC(12, 2) NOT NULL DEFAULT 500 CHECK (budget > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2) NOT NULL DEFAULT 500 CHECK (budget > 0);

CREATE TABLE IF NOT EXISTS waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  sequence_order INTEGER NOT NULL CHECK (sequence_order >= 0),
  location GEOGRAPHY(POINT, 4326),
  UNIQUE (trip_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS waypoints_location_idx ON waypoints USING GIST (location);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  paid_by_user TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION waypoints_set_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waypoints_location ON waypoints;

CREATE TRIGGER waypoints_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON waypoints
FOR EACH ROW
EXECUTE FUNCTION waypoints_set_location();
