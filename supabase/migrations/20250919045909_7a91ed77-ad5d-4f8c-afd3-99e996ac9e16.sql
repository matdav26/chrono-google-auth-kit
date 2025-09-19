-- First, let's check and drop any triggers related to RAG
DROP TRIGGER IF EXISTS update_rag_on_document_trigger ON documents;
DROP TRIGGER IF EXISTS update_rag_on_project_trigger ON projects;
DROP TRIGGER IF EXISTS update_rag_on_action_item_trigger ON action_items;
DROP TRIGGER IF EXISTS update_rag_on_event_trigger ON events;
DROP TRIGGER IF EXISTS update_rag_on_log_trigger ON activity_logs;
DROP TRIGGER IF EXISTS chunk_document_content_trigger ON documents;

-- Drop the RAG-related functions
DROP FUNCTION IF EXISTS update_rag_on_document() CASCADE;
DROP FUNCTION IF EXISTS update_rag_on_project() CASCADE;
DROP FUNCTION IF EXISTS update_rag_on_action_item() CASCADE;
DROP FUNCTION IF EXISTS update_rag_on_event() CASCADE;
DROP FUNCTION IF EXISTS update_rag_on_log() CASCADE;
DROP FUNCTION IF EXISTS chunk_document_content() CASCADE;
DROP FUNCTION IF EXISTS match_rag_context(vector, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS match_rag_context(vector, uuid, integer, double precision) CASCADE;

-- Now drop the rag_context table if it exists
DROP TABLE IF EXISTS rag_context CASCADE;

-- Also drop the chat tables that were RAG-related
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;