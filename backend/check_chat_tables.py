#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.supabase_client import supabase

# Check if chat tables exist
try:
    # Test chat_sessions table
    response = supabase.table("chat_sessions").select("*").limit(1).execute()
    print("✅ chat_sessions table exists")
except Exception as e:
    print(f"❌ chat_sessions table error: {e}")

try:
    # Test chat_messages table
    response = supabase.table("chat_messages").select("*").limit(1).execute()
    print("✅ chat_messages table exists")
except Exception as e:
    print(f"❌ chat_messages table error: {e}")
