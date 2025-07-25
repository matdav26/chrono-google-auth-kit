import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();
    console.log('New document inserted:', record);

    // Extract the document ID
    const docId = record.id;
    
    if (!docId) {
      console.error('No document ID found in record');
      return new Response(JSON.stringify({ error: 'No document ID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send POST request to external API
    const response = await fetch('https://my-backend-url.com/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: docId
      }),
    });

    if (!response.ok) {
      console.error('External API request failed:', response.status, response.statusText);
      return new Response(JSON.stringify({ 
        error: 'External API request failed',
        status: response.status 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully sent document for processing:', docId);
    
    return new Response(JSON.stringify({ 
      success: true,
      doc_id: docId,
      message: 'Document sent for processing'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in on_new_document function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});