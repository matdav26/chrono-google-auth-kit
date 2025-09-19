import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

bearer_scheme = HTTPBearer()

# Get these from your Render environment variables
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Must be set!
SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID")  # Already confirmed ✅
SUPABASE_JWT_AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
SUPABASE_JWT_ISSUER = f"https://{SUPABASE_PROJECT_ID}.supabase.co/auth/v1"

if not SUPABASE_JWT_SECRET:
    raise RuntimeError("SUPABASE_JWT_SECRET is not set in environment variables.")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=SUPABASE_JWT_AUDIENCE,
            issuer=SUPABASE_JWT_ISSUER
        )

        # 🔍 Add these two debug prints here
        print("🔐 Decoded token payload:", payload)
        user_id = payload.get("sub")
        print("✅ Returning user_id:", user_id)

        if not user_id:
            raise HTTPException(status_code=401, detail="Missing user ID in token")

        return user_id

    except JWTError as e:
        print("❌ JWT validation failed:", str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication token")
