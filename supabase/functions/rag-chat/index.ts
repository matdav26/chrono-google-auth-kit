import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

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
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { message, project_id, session_id } = await req.json();

    if (!message || !project_id) {
      return new Response(
        JSON.stringify({ error: 'message and project_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user has access to the project
    const { data: membershipData, error: membershipError } = await supabaseClient
      .from('project_memberships')
      .select('*')
      .eq('project_id', project_id)
      .single();

    if (membershipError || !membershipData) {
      console.error('Membership check failed:', membershipError);
      return new Response(
        JSON.stringify({ error: 'Access denied to this project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get relevant context from rag_context table using vector similarity search
    // For now, we'll do a basic text search since we don't have embeddings set up yet
    const { data: contextData, error: contextError } = await supabaseClient
      .from('rag_context')
      .select('*')
      .eq('project_id', project_id)
      .limit(5);

    if (contextError) {
      console.error('Error fetching context:', contextError);
    }

    // Format sources from the context data
    const sources = contextData?.map(item => ({
      content: item.content,
      metadata: {
        source_type: item.source_type,
        source_id: item.source_id,
        created_at: item.created_at
      }
    })) || [];

    // Prepare context for AI response
    const contextText = sources.map(s => s.content).join('\n\n');
    
    // For now, we'll return a simple response based on the context
    // In a real implementation, you would call an AI service here
    let aiResponse = '';
    
    if (contextText) {
      // Generate a contextual response based on what we found
      if (message.toLowerCase().includes('action') || message.toLowerCase().includes('task')) {
        const actionItems = sources.filter(s => s.metadata.source_type === 'action_item');
        if (actionItems.length > 0) {
          aiResponse = `Based on the project data, I found ${actionItems.length} action item(s). Here's what I found:\n\n${actionItems.map(a => a.content).join('\n')}`;
        } else {
          aiResponse = "I couldn't find any action items in the current project. You can create new action items from the Action Items panel.";
        }
      } else if (message.toLowerCase().includes('event') || message.toLowerCase().includes('meeting')) {
        const events = sources.filter(s => s.metadata.source_type === 'event');
        if (events.length > 0) {
          aiResponse = `I found ${events.length} event(s) in the project. Here's a summary:\n\n${events.map(e => e.content).join('\n')}`;
        } else {
          aiResponse = "No events have been recorded yet in this project. You can add events from the Events panel.";
        }
      } else if (message.toLowerCase().includes('document') || message.toLowerCase().includes('file')) {
        const documents = sources.filter(s => s.metadata.source_type === 'document');
        if (documents.length > 0) {
          aiResponse = `There are ${documents.length} document(s) in the project:\n\n${documents.map(d => d.content).join('\n')}`;
        } else {
          aiResponse = "No documents have been uploaded to this project yet. You can upload documents from the Documents panel.";
        }
      } else {
        // General response
        if (contextText) {
          aiResponse = `Based on your project data, here's what I found relevant to your question:\n\n${contextText.substring(0, 500)}${contextText.length > 500 ? '...' : ''}`;
        } else {
          aiResponse = "I don't have enough context about your project yet. Try adding some documents, events, or action items first!";
        }
      }
    } else {
      aiResponse = "Your project doesn't have any data yet. Start by adding documents, creating events, or adding action items to build up your project's knowledge base.";
    }

    // Store the conversation in activity logs for history
    const { error: logError } = await supabaseClient
      .from('activity_logs')
      .insert({
        project_id,
        user_id: membershipData.user_id,
        action: 'ai_chat',
        resource_type: 'chat',
        resource_name: 'AI Assistant',
        details: {
          question: message,
          response: aiResponse,
          session_id: session_id || `session-${Date.now()}`,
          sources_count: sources.length
        }
      });

    if (logError) {
      console.error('Error logging chat activity:', logError);
    }

    // Return the response
    return new Response(
      JSON.stringify({
        response: aiResponse,
        sources: sources,
        session_id: session_id || `session-${Date.now()}`,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in rag-chat function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});