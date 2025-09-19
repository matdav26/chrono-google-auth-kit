#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.supabase_client import supabase

# Get project metadata
project_id = "5f6edc71-aeb4-4eed-8b19-f9282af3589a"
response = supabase.table("projects").select("*").eq("id", project_id).execute()

if response.data:
    project = response.data[0]
    print(f"Project Name: {project.get('name', 'N/A')}")
    print(f"Project Description: {project.get('description', 'N/A')}")
    print(f"Full project data: {project}")
else:
    print("No project found")
