-- What kind of place a stop is, so the app can show a fitting picture. NULL when unknown, like a plain address.
ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('food', 'gas', 'beach', 'sights', 'lodging'));
