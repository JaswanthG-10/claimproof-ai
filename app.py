import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.routes import router

app = FastAPI(
    title="ClaimProof AI - Insurance Claims Evidence Review Assistant",
    description="End-to-End GenAI & Deterministic Evidence Review System for Motor Insurance Claims (TRACK_ID=PS02)",
    version="1.0.0"
)

# 1. Include API routes first
app.include_router(router)

# 2. React frontend dist directory
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
frontend_assets = os.path.join(frontend_dist, "assets")

# Mount React static assets (/assets/...)
if os.path.exists(frontend_assets):
    app.mount("/assets", StaticFiles(directory=frontend_assets), name="react_assets")

# Mount legacy static files directory (/static/...)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Catch-all for SPA client routing and public static files (favicon.svg, icons.svg, etc.)
@app.get("/{full_path:path}")
async def serve_spa_and_public(full_path: str):
    # Check if a public file directly in frontend/dist exists
    candidate = os.path.join(frontend_dist, full_path)
    if os.path.isfile(candidate):
        return FileResponse(candidate)
    
    # Fallback to React index.html for SPA routing
    react_index = os.path.join(frontend_dist, "index.html")
    if os.path.exists(react_index):
        return FileResponse(react_index)
    return FileResponse("templates/index.html")

if __name__ == "__main__":
    print("=" * 60)
    print("Starting ClaimProof AI Server (TRACK_ID=PS02)...")
    print("Unified Server URL: http://localhost:8000")
    print("=" * 60)
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)

