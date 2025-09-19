from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Prefer the *service role* key for backend ops

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_project_context(project_id: str):
    """Fetch unified project context from projects"""
    try:
        response = supabase.table("projects").select("*").eq("project_id", project_id).execute()
        return response.data
    except Exception as e:
        print(f"❌ Error fetching project context: {e}")
        return None
