import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.persistence.database import init_db, get_db
from app.api.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    await init_db()
    
    # Load initial scenario if none exists
    async for db in get_db():
        from app.domain.services.digital_twin_service import digital_twin_service
        from app.persistence.scenario_seeder import load_scenario
        scenario = await digital_twin_service.get_active_scenario(db)
        if not scenario:
            await load_scenario(db)
        break
    
    yield
    # Cleanup on shutdown
    pass

app = FastAPI(
    title="ReliefOS API",
    description="Backend API for ReliefOS - Disaster Resource Orchestration Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

