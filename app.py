import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from src.routes import router

app = FastAPI(
    title="ClaimProof AI - Insurance Claims Evidence Review Assistant",
    description="End-to-End GenAI & Deterministic Evidence Review System for Motor Insurance Claims (TRACK_ID=PS02)",
    version="1.0.0"
)

# Mount static files directory
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include API routes
app.include_router(router)

if __name__ == "__main__":
    print("=" * 60)
    print("Starting ClaimProof AI Server (TRACK_ID=PS02)...")
    print("Server URL: http://localhost:8000")
    print("=" * 60)
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
