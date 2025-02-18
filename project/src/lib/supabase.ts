import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

let authPromise: Promise<void> | null = null;

export async function ensureAuth() {
  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: 'anonymous@example.com',
          password: 'anonymous123'
        });

        if (signInError) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: 'anonymous@example.com',
            password: 'anonymous123'
          });

          if (signUpError) {
            throw signUpError;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));

          const { error: finalSignInError } = await supabase.auth.signInWithPassword({
            email: 'anonymous@example.com',
            password: 'anonymous123'
          });

          if (finalSignInError) {
            throw finalSignInError;
          }
        }
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      authPromise = null;
      throw error;
    }
  })();

  return authPromise;
}

export async function logTranscriptionEvent(
  fileId: string,
  level: 'info' | 'warning' | 'error',
  message: string
) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      await ensureAuth();
      
      const { error } = await supabase
        .from('transcription_logs')
        .insert([{ 
          file_id: fileId, 
          level, 
          message,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        throw error;
      }
      
      return;
    } catch (err) {
      console.error(`Failed to log event (retries left: ${retries - 1}):`, err);
      retries--;
      
      if (retries === 0) {
        throw err;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export async function updateFileStatus(
  fileId: string,
  status: string,
  progress?: number,
  error?: string
) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      await ensureAuth();
      
      const updateData: any = {
        status,
        progress: progress ?? null,
        error: error ?? null,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.processing_time = Date.now();
      }

      const { error: updateError } = await supabase
        .from('transcription_files')
        .update(updateData)
        .eq('id', fileId);

      if (updateError) {
        throw updateError;
      }
      
      return;
    } catch (err) {
      console.error(`Failed to update file status (retries left: ${retries - 1}):`, err);
      retries--;
      
      if (retries === 0) {
        throw err;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}