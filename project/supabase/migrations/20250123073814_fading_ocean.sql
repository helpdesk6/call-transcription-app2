/*
  # Add updated_at column to transcription_files

  1. Changes
    - Add `updated_at` timestamp column to `transcription_files` table
    - Set default value to now()
    - Add trigger to automatically update the timestamp
*/

-- Add updated_at column
ALTER TABLE transcription_files 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_transcription_files_updated_at ON transcription_files;
CREATE TRIGGER update_transcription_files_updated_at
    BEFORE UPDATE ON transcription_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();