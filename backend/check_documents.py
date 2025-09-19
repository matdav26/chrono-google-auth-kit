#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.supabase_client import supabase

# Check what documents are actually in the database
project_id = "5f6edc71-aeb4-4eed-8b19-f9282af3589a"
response = supabase.table("documents").select("*").eq("project_id", project_id).execute()

print(f"�� Documents in project {project_id}:")
print(f"Total documents: {len(response.data or [])}")
print()

for i, doc in enumerate(response.data or [], 1):
    print(f"{i}. {doc.get('filename', 'Unknown')}")
    print(f"   Type: {doc.get('doc_type', 'Unknown')}")
    summary = doc.get('summary', 'None')
    if summary:
        print(f"   Summary: {summary[:100]}...")
    else:
        print(f"   Summary: None")
    print(f"   Processed: {doc.get('processed', False)}")
    print()
