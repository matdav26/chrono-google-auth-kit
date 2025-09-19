import os
import asyncio
import json
import logging
from typing import Dict, Any, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx
from datetime import datetime

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealtimeListener:
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.is_running = False
        self.http_client = None
        
        self.monitored_tables = ["events", "documents", "action_items"]
        
        logger.info(f"🔌 RealtimeListener initialized for tables: {self.monitored_tables}")
    
    async def start(self):
        """Start the realtime listener"""
        if self.is_running:
            logger.warning("⚠️ RealtimeListener is already running")
            return
        
        try:
            logger.info("🚀 Starting Supabase Realtime listener...")
            
            # Create HTTP client for calling backend endpoints
            self.http_client = httpx.AsyncClient(timeout=30.0)
            
            # Subscribe to changes on monitored tables
            for table in self.monitored_tables:
                await self._subscribe_to_table(table)
            
            self.is_running = True
            logger.info("✅ RealtimeListener started successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to start RealtimeListener: {e}")
            # Don't raise the exception to prevent app crash
            logger.warning("⚠️ Continuing without Realtime listener")
    
    async def stop(self):
        """Stop the realtime listener"""
        if not self.is_running:
            logger.warning("⚠️ RealtimeListener is not running")
            return
        
        try:
            logger.info("🛑 Stopping RealtimeListener...")
            
            # Close HTTP client
            if self.http_client:
                await self.http_client.aclose()
            
            self.is_running = False
            logger.info("✅ RealtimeListener stopped successfully")
            
        except Exception as e:
            logger.error(f"❌ Error stopping RealtimeListener: {e}")
    
    async def _subscribe_to_table(self, table_name: str):
        """Subscribe to changes on a specific table"""
        try:
            logger.info(f"📡 Subscribing to table: {table_name}")
            
            # Create channel for the table
            channel = self.supabase.realtime.channel(f"public:{table_name}")
            
            # Define callback function
            def handle_change(payload):
                asyncio.create_task(self._handle_change(table_name, payload))
            
            # Subscribe to INSERT, UPDATE, DELETE events
            channel.on("postgres_changes", 
                      event="INSERT", 
                      schema="public", 
                      table=table_name,
                      callback=handle_change)
            
            channel.on("postgres_changes", 
                      event="UPDATE", 
                      schema="public", 
                      table=table_name,
                      callback=handle_change)
            
            channel.on("postgres_changes", 
                      event="DELETE", 
                      schema="public", 
                      table=table_name,
                      callback=handle_change)
            
            # Subscribe to the channel
            await channel.subscribe()
            logger.info(f"✅ Subscribed to {table_name} changes")
            
        except Exception as e:
            logger.error(f"❌ Failed to subscribe to {table_name}: {e}")
            # Don't raise to prevent app crash
    
    async def _handle_change(self, table_name: str, payload: Dict[str, Any]):
        try:
            # Extract event type from payload
            event_type = payload.get("eventType", "UNKNOWN")
            logger.info(f"🔄 Received {event_type} event on {table_name}")
            logger.info(f"📋 Payload: {json.dumps(payload, indent=2)}")
            
            # Extract project_id from the changed row
            project_id = self._extract_project_id(table_name, payload, event_type)
            
            if not project_id:
                logger.warning(f"⚠️ Could not extract project_id from {event_type} on {table_name}")
                return
            
            
            # Call the backend's index-rag endpoint
# Global instance
realtime_listener = RealtimeListener() 