/*
  # External Database Integration

  1. Changes
    - Create external database settings table
    - Create cache table for external calls
    - Add indexes for better performance
    - Set up initial connection settings
*/

-- Create external database settings table if not exists
CREATE TABLE IF NOT EXISTS external_database_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  database_name text NOT NULL,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_port CHECK (port > 0 AND port < 65536)
);

-- Create cache table for external calls if not exists
CREATE TABLE IF NOT EXISTS external_calls_cache (
  id text PRIMARY KEY,
  call_date timestamptz NOT NULL,
  source text,
  destination text,
  recording_file text,
  transcription text,
  imported_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance if not exist
CREATE INDEX IF NOT EXISTS idx_external_calls_call_date_desc 
  ON external_calls_cache (call_date DESC);

CREATE INDEX IF NOT EXISTS idx_external_calls_imported_at 
  ON external_calls_cache (imported_at);

CREATE INDEX IF NOT EXISTS idx_external_calls_source_dest 
  ON external_calls_cache (source, destination);

-- Create text search index using simple configuration
CREATE INDEX IF NOT EXISTS idx_external_calls_transcription 
  ON external_calls_cache USING gin (to_tsvector('simple', COALESCE(transcription, '')));

-- Add trigger for updated_at if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_external_calls_cache_updated_at'
  ) THEN
    CREATE TRIGGER update_external_calls_cache_updated_at
      BEFORE UPDATE ON external_calls_cache
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Insert initial settings if not exist
INSERT INTO external_database_settings 
  (host, port, username, password, database_name)
VALUES 
  ('10.2.0.152', 8186, 'asterisk', 'apc25u', 'asterisk')
ON CONFLICT DO NOTHING;