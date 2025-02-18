import { Pool, PoolConfig } from 'pg';
import { supabase } from './supabase';

let pool: Pool | null = null;

export async function initSecondaryDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
    // Отримуємо налаштування з Supabase
    const { data: settings, error } = await supabase
      .from('database_settings')
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to get database settings: ${error.message}`);
    }

    if (!settings) {
      throw new Error('No database settings found');
    }

    const config: PoolConfig = {
      host: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password,
      database: settings.database,
      ssl: {
        rejectUnauthorized: false // Налаштуйте відповідно до ваших потреб
      }
    };

    pool = new Pool(config);

    // Перевіряємо з'єднання
    await pool.query('SELECT NOW()');
    console.log('Secondary database connected successfully');

    return pool;
  } catch (error) {
    console.error('Failed to initialize secondary database:', error);
    throw error;
  }
}

export async function getSecondaryDatabase(): Promise<Pool> {
  if (!pool) {
    return initSecondaryDatabase();
  }
  return pool;
}

export async function closeSecondaryDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Функція для синхронізації даних між базами
export async function syncDatabases(): Promise<void> {
  try {
    const db = await getSecondaryDatabase();

    // Отримуємо дані з Supabase
    const { data: files, error } = await supabase
      .from('transcription_files')
      .select('*');

    if (error) {
      throw error;
    }

    // Синхронізуємо з другою базою
    for (const file of files || []) {
      await db.query(
        `INSERT INTO audio_analysis (
          audio_file_name,
          transcription_text,
          analysis_result,
          evaluation
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (audio_file_name) DO UPDATE SET
          transcription_text = EXCLUDED.transcription_text,
          analysis_result = EXCLUDED.analysis_result,
          evaluation = EXCLUDED.evaluation`,
        [
          file.name,
          file.transcription,
          file.analysis ? JSON.stringify(file.analysis) : null,
          file.analysis?.temperature || null
        ]
      );
    }

    console.log('Databases synchronized successfully');
  } catch (error) {
    console.error('Failed to sync databases:', error);
    throw error;
  }
}