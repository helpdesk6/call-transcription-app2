/*
  # Initial schema for audio transcription app

  1. New Tables
    - `transcription_files`
      - `id` (uuid, primary key)
      - `name` (text)
      - `path` (text)
      - `size` (bigint)
      - `status` (text)
      - `language` (text)
      - `transcription` (text)
      - `error` (text)
      - `progress` (integer)
      - `processing_time` (float)
      - `created_at` (timestamp)
      - `user_id` (uuid, foreign key)
    
    - `transcription_logs`
      - `id` (uuid, primary key)
      - `file_id` (uuid, foreign key)
      - `level` (text)
      - `message` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Створення таблиці для файлів транскрибації
CREATE TABLE transcription_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  path text NOT NULL,
  size bigint NOT NULL,
  status text NOT NULL,
  language text,
  transcription text,
  error text,
  progress integer DEFAULT 0,
  processing_time float,
  created_at timestamptz DEFAULT now()
);

-- Створення таблиці для логів
CREATE TABLE transcription_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES transcription_files(id) ON DELETE CASCADE,
  level text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Налаштування безпеки
ALTER TABLE transcription_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_logs ENABLE ROW LEVEL SECURITY;

-- Політики для файлів
CREATE POLICY "Users can view their own files"
  ON transcription_files
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON transcription_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
  ON transcription_files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Політики для логів
CREATE POLICY "Users can view logs for their files"
  ON transcription_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transcription_files
      WHERE transcription_files.id = transcription_logs.file_id
      AND transcription_files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert logs for their files"
  ON transcription_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transcription_files
      WHERE transcription_files.id = transcription_logs.file_id
      AND transcription_files.user_id = auth.uid()
    )
  );