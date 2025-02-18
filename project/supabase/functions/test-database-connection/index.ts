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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get database settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('external_database_settings')
      .select('*')
      .single()

    if (settingsError) {
      throw new Error(`Failed to get database settings: ${settingsError.message}`)
    }

    if (!settings) {
      throw new Error('No external database settings found')
    }

    // Create a connection pool
    const pool = new Pool({
      hostname: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password,
      database: settings.database_name,
      tls: { enabled: false }
    }, 1) // Only one connection for testing

    try {
      const client = await pool.connect()
      try {
        // Test the connection with a simple query
        await client.queryObject('SELECT NOW()')
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Database connection successful'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } finally {
        client.release()
      }
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`)
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error('Error testing database connection:', error)
    
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