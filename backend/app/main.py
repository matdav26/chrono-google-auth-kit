from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from app.api import routes
from app.api import webhooks
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["https://your-frontend.com"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount core routers
app.include_router(routes.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Hello from ChronoBoard API 🚀"}

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "features": {
            "document_upload": True,
            "ai_summaries": True,
            "project_management": True
        },
        "realtime_listener": {
            "running": False,  # Temporarily disabled
            "monitored_tables": ["events", "documents", "action_items"],
            "status": "disabled_due_to_sync_client_issues"
        }
    }

@app.on_event("startup")
async def startup_event():
    try:
        logger.info("🚀 Starting FastAPI application...")
        logger.info("⚠️ Realtime listener temporarily disabled")
    except Exception as e:
        logger.error(f"❌ Failed to start application: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    try:
        logger.info("🛑 Shutting down FastAPI application...")
        logger.info("⚠️ Realtime listener was disabled")
    except Exception as e:
        logger.error(f"❌ Error stopping application: {e}")
