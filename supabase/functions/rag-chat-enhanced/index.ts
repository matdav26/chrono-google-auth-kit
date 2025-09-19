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
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { message, project_id } = await req.json();

    if (!message || !project_id) {
      throw new Error('Missing required parameters: message and project_id');
    }

    // Create Supabase client with user's token
    const supabase = createClient(supabaseUrl, token);
    
    // Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user has access to the project
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw new Error('You do not have access to this project');
    }

    // Generate embedding for the user's message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Use service role client for RPC call
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Find similar content using the embedding
    const { data: similarContent, error: rpcError } = await serviceSupabase
      .rpc('match_rag_context', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_project_id: project_id,
        match_count: 10
      });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      throw rpcError;
    }

    // Format context for OpenAI
    let context = '';
    const sources = [];
    
    if (similarContent && similarContent.length > 0) {
      for (const item of similarContent) {
        if (item.similarity > 0.7) { // Only include highly relevant content
          context += `\n[${item.source_type.toUpperCase()}]: ${item.content}\n`;
          
          // Get more details about the source
          let sourceDetails = null;
          
          switch (item.source_type) {
            case 'document':
              const { data: doc } = await supabase
                .from('documents')
                .select('filename, summary, raw_text')
                .eq('id', item.source_id)
                .single();
              sourceDetails = doc;
              break;
            case 'event':
              const { data: event } = await supabase
                .from('events')
                .select('event_name, event_description, event_date')
                .eq('id', item.source_id)
                .single();
              sourceDetails = event;
              break;
            case 'action_item':
              const { data: action } = await supabase
                .from('action_items')
                .select('action_name, description, status, deadline')
                .eq('id', item.source_id)
                .single();
              sourceDetails = action;
              break;
          }
          
          sources.push({
            type: item.source_type,
            content: item.content,
            metadata: sourceDetails,
            similarity: item.similarity
          });
        }
      }
    }

    // Generate response using OpenAI with context
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful project management assistant. You have access to the following project context:
            
${context}

Use this information to answer questions about the project. Be specific and reference the actual data when relevant.
If the context doesn't contain relevant information, say so clearly.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    const chatData = await chatResponse.json();
    const aiResponse = chatData.choices[0].message.content;

    // Log the interaction
    await supabase
      .from('activity_logs')
      .insert({
        project_id,
        user_id: user.id,
        action: 'rag_chat',
        resource_type: 'ai_chat',
        resource_name: 'ChronoBoard AI Enhanced',
        details: {
          message,
          response: aiResponse,
          sources_used: sources.length
        }
      });

    return new Response(
      JSON.stringify({
        response: aiResponse,
        sources: sources,
        session: {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in rag-chat-enhanced:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});