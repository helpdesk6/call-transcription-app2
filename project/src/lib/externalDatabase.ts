import { supabase } from './supabase';
import type { AudioFile } from '../types';
import { toast } from 'react-hot-toast';

let syncInProgress = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 10000; // Мінімальний інтервал між синхронізаціями (10 секунд)

export async function syncExternalCalls(timeout = 30000): Promise<void> {
  // Перевіряємо чи не занадто часто викликаємо синхронізацію
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    return;
  }

  if (syncInProgress) {
    return;
  }

  try {
    syncInProgress = true;
    lastSyncTime = now;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const { data, error } = await supabase.functions.invoke('sync-external-calls', {
      signal: controller.signal,
      body: { lastSync: lastSyncTime }
    });
    
    clearTimeout(timeoutId);

    if (error) {
      if (error.name === 'AbortError') {
        console.warn('Sync operation timed out');
        return;
      }

      if (error.name === 'FunctionsFetchError') {
        console.error('Edge Function not deployed or misconfigured');
        return;
      }

      console.error('Sync error:', error);
      toast.error('Помилка синхронізації з зовнішньою базою');
      throw error;
    }

    if (data?.message) {
      console.log('Sync result:', data.message);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Sync operation timed out');
      return;
    }

    if (error.name === 'FunctionsFetchError') {
      // Тиха помилка для FunctionsFetchError
      return;
    }

    console.error('Failed to sync external calls:', error);
    throw error;
  } finally {
    syncInProgress = false;
  }
}

export async function getExternalCalls(
  page = 1,
  pageSize = 25,
  search?: string
): Promise<{ data: AudioFile[]; total: number }> {
  try {
    let query = supabase
      .from('external_calls_cache')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`source.ilike.%${search}%,destination.ilike.%${search}%,transcription.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('call_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('Database error:', error);
      toast.error('Помилка отримання даних');
      throw error;
    }

    return {
      data: (data || []).map(row => ({
        id: row.id,
        name: `${new Date(row.call_date).toLocaleString('uk-UA')} - ${row.source} → ${row.destination}`,
        path: row.recording_file,
        size: 0,
        status: 'completed',
        transcription: row.transcription,
        progress: 100,
        createdAt: new Date(row.call_date),
        analysis: {
          problems: [],
          solutions: [],
          temperature: 5,
          summary: ''
        }
      })),
      total: count || 0
    };
  } catch (error) {
    console.error('Failed to get external calls:', error);
    throw error;
  }
}