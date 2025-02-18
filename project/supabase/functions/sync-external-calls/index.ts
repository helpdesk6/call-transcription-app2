import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with retries
    const createClientWithRetry = async (attempts = 3) => {
      for (let i = 0; i < attempts; i++) {
        try {
          return createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )
        } catch (error) {
          if (i === attempts - 1) throw error
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
        }
      }
    }

    const supabaseClient = await createClientWithRetry()

    // Get database settings with retry
    const getSettings = async (attempts = 3) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const { data, error } = await supabaseClient
            .from('external_database_settings')
            .select('*')
            .single()

          if (error) throw error
          if (!data) throw new Error('No external database settings found')
          return data
        } catch (error) {
          if (i === attempts - 1) throw error
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
        }
      }
    }

    const settings = await getSettings()

    // Connect to external database with connection pool
    const pool = new Pool({
      hostname: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password,
      database: settings.database_name,
      tls: { enabled: false }
    }, 3)

    try {
      const client = await pool.connect()

      try {
        // Get last sync time
        const lastSyncAt = settings.last_sync_at

        // Fetch new records with pagination
        const BATCH_SIZE = 100
        let totalSynced = 0
        let hasMore = true
        let offset = 0

        while (hasMore) {
          const result = await client.queryObject(`
            SELECT 
              id::text, 
              calldate, 
              src, 
              dst, 
              recordingfile, 
              call_transcription 
            FROM cdr 
            WHERE call_transcription is not null
            ${lastSyncAt ? `AND calldate > $1` : ''}
            ORDER BY calldate DESC
            LIMIT $${lastSyncAt ? '2' : '1'}
            OFFSET $${lastSyncAt ? '3' : '2'}
          `, lastSyncAt ? [lastSyncAt, BATCH_SIZE, offset] : [BATCH_SIZE, offset])

          const rows = result.rows
          if (rows.length === 0) {
            hasMore = false
            break
          }

          // Update cache
          const { error: upsertError } = await supabaseClient
            .from('external_calls_cache')
            .upsert(
              rows.map((row: any) => ({
                id: row.id,
                call_date: row.calldate,
                source: row.src,
                destination: row.dst,
                recording_file: row.recordingfile,
                transcription: row.call_transcription
              }))
            )

          if (upsertError) {
            throw upsertError
          }

          totalSynced += rows.length
          offset += BATCH_SIZE

          // Limit total number of records per sync
          if (totalSynced >= 1000) {
            hasMore = false
          }
        }

        // Update last sync time
        if (totalSynced > 0) {
          await supabaseClient
            .from('external_database_settings')
            .update({ 
              last_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', settings.id)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Synced ${totalSynced} records` 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } finally {
        client.release()
      }
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error('Error in sync-external-calls:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})