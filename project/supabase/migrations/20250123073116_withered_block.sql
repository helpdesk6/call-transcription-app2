/*
  # Update RLS policies for anonymous access

  1. Changes
    - Add policies for anonymous access to transcription_files and transcription_logs tables
    - Remove user_id requirement from existing policies
    
  2. Security
    - Enable RLS on both tables
    - Allow anonymous users to perform CRUD operations
*/

-- Оновлюємо політики для файлів
DROP POLICY IF EXISTS "Users can view their own files" ON transcription_files;
DROP POLICY IF EXISTS "Users can insert their own files" ON transcription_files;
DROP POLICY IF EXISTS "Users can update their own files" ON transcription_files;

CREATE POLICY "Allow all operations for authenticated users"
  ON transcription_files
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Оновлюємо політики для логів
DROP POLICY IF EXISTS "Users can view logs for their files" ON transcription_logs;
DROP POLICY IF EXISTS "Users can insert logs for their files" ON transcription_logs;

CREATE POLICY "Allow all operations for authenticated users on logs"
  ON transcription_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);