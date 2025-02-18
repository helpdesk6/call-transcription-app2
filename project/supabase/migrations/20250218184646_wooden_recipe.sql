/*
  # Add external database configuration

  1. New Tables
    - `external_database_settings`
      - Configuration for external Asterisk database
    - `external_calls_cache`
      - Cache table for external call records
      
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create external database settings table
CREATE TABLE IF NOT EXISTS external_database_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  database_name text NOT NULL,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cache table for external calls
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

-- Enable RLS
ALTER TABLE external_database_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_calls_cache ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations for authenticated users on settings"
  ON external_database_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on cache"
  ON external_calls_cache
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_external_calls_call_date 
  ON external_calls_cache (call_date DESC);

CREATE INDEX IF NOT EXISTS idx_external_calls_imported 
  ON external_calls_cache (imported_at);

-- Add trigger for updated_at
CREATE TRIGGER update_external_calls_cache_updated_at
  BEFORE UPDATE ON external_calls_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial settings
INSERT INTO external_database_settings 
  (host, port, username, password, database_name)
VALUES 
  ('10.2.0.152', 8186, 'asterisk', 'apc25u', 'asterisk')
ON CONFLICT DO NOTHING;