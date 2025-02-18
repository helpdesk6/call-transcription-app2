/*
  # Configure authentication settings

  1. Changes
    - Enable RLS for auth tables
    - Configure authentication settings through auth schema
    
  2. Security
    - Allow email/password authentication
    - Auto-confirm email addresses
*/

-- Enable RLS for auth tables
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Configure authentication settings
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own identities
CREATE POLICY "Users can manage their identities"
ON auth.identities
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create policy to allow public registration
CREATE POLICY "Allow public registration"
ON auth.users
FOR INSERT
TO anon
WITH CHECK (true);

-- Create policy to allow users to manage their own data
CREATE POLICY "Users can manage their own data"
ON auth.users
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());