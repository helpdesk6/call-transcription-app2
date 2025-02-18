/*
  # Add database settings

  1. New Tables
    - `database_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `host` (text)
      - `port` (integer)
      - `username` (text)
      - `password` (text, encrypted)
      - `database` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `database_settings` table
    - Add policy for authenticated users to manage their settings
*/

-- Create database settings table
CREATE TABLE IF NOT EXISTS database_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  host text NOT NULL,
  port integer NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  database text NOT NULL,
  is_initialized boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE database_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their database settings"
ON database_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_database_settings_updated_at
  BEFORE UPDATE ON database_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();