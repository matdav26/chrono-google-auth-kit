#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.supabase_client import supabase

# Check action items for Test_P project
project_id = "5f6edc71-aeb4-4eed-8b19-f9282af3589a"
print(f"�� Checking action items for project: {project_id}")

# Check what's in the action_items table
action_items_response = supabase.table("action_items").select("*").eq("project_id", project_id).execute()
print(f"\n📊 Action items in database: {len(action_items_response.data or [])}")

for i, item in enumerate(action_items_response.data or [], 1):
    print(f"{i}. {item.get('action_name', 'Unknown')}")
    print(f"   Description: {item.get('description', 'None')}")
    print(f"   Status: {item.get('status', 'Unknown')}")
    print(f"   Deadline: {item.get('deadline', 'None')}")
    print()

