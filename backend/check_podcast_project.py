#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.supabase_client import supabase

# Find the project ID for "Project - Podcast Improvement New"
project_name = "Project - Podcast Improvement New"
response = supabase.table("projects").select("id, name").eq("name", project_name).execute()

if response.data:
    podcast_project_id = response.data[0]["id"]
    print(f"✅ Found Project ID for '{project_name}': {podcast_project_id}")
    
    # Check what documents are in this project
    docs_response = supabase.table("documents").select("*").eq("project_id", podcast_project_id).execute()
    print(f"\n📊 Documents in this project: {len(docs_response.data or [])}")
    
    for i, doc in enumerate(docs_response.data or [], 1):
        print(f"{i}. {doc.get('filename', 'Unknown')}")
        print(f"   Type: {doc.get('doc_type', 'Unknown')}")
        summary = doc.get('summary', 'None')
        if summary:
            print(f"   Summary: {summary[:100]}...")
        else:
            print(f"   Summary: None")
        print()
        
