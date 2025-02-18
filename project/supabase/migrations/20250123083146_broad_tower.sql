/*
  # Add analysis features and duration tracking

  1. New Columns
    - Added to transcription_files:
      - `duration` (integer) - Duration of audio in seconds
      - `analysis` (jsonb) - Stores analysis results
      - `analysis_type` (text) - Type of analysis (openai/local)
      - `duplicate_of` (uuid) - Reference to original file if duplicate

  2. New Table
    - `analysis_settings`
      - Stores analysis configuration

  3. Changes
    - Added unique constraint on file name for duplicate detection
    - Added analysis-related columns
*/

-- Add new columns to transcription_files
ALTER TABLE transcription_files
ADD COLUMN IF NOT EXISTS duration integer,
ADD COLUMN IF NOT EXISTS analysis jsonb,
ADD COLUMN IF NOT EXISTS analysis_type text,
ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES transcription_files(id);

-- Create analysis settings table
CREATE TABLE IF NOT EXISTS analysis_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  openai_model text DEFAULT 'gpt-4',
  local_model_url text DEFAULT 'http://ollama:11434',
  use_local_model boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for analysis_settings
ALTER TABLE analysis_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for analysis_settings
CREATE POLICY "Users can manage their analysis settings"
ON analysis_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at on analysis_settings
CREATE TRIGGER update_analysis_settings_updated_at
  BEFORE UPDATE ON analysis_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();