import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all rag_context entries without embeddings
    const { data: contextEntries, error: fetchError } = await supabase
      .from('rag_context')
      .select('id, content')
      .is('embedding', null)
      .limit(50); // Process in batches

    if (fetchError) throw fetchError;

    if (!contextEntries || contextEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No entries to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate embeddings for each entry
    const updates = [];
    
    for (const entry of contextEntries) {
      try {
        // Generate embedding using OpenAI
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: entry.content,
          }),
        });

        const data = await response.json();
        
        if (data.data && data.data[0]) {
          const embedding = data.data[0].embedding;
          
          // Update the entry with the embedding
          const { error: updateError } = await supabase
            .from('rag_context')
            .update({ embedding: `[${embedding.join(',')}]` })
            .eq('id', entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            updates.push(entry.id);
          }
        }
      } catch (err) {
        console.error(`Failed to generate embedding for entry ${entry.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${updates.length} entries`,
        processedIds: updates 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});