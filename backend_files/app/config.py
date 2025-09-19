"""
Configuration settings for ChronoBoard backend
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Feature Flags

# Other settings
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# API Settings
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
ALLOWED_FILE_EXTENSIONS = [".pdf", ".docx", ".txt"]

print(f"🔧 Configuration loaded:")
print(f"   Debug Mode: {DEBUG}")
print(f"   Log Level: {LOG_LEVEL}")
