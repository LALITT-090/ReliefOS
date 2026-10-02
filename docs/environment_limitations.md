# Environment Limitations and Fallbacks

This document outlines legitimate infrastructure limitations encountered in the current environment and the isolated fallback mechanisms implemented to ensure the prototype runs while preserving the documented target architecture.

## 1. Database Infrastructure

**Documented Target:** PostgreSQL + PostGIS  
**Current Environment:** Local Windows environment without PostgreSQL installed, no Docker available to run a PostgreSQL container.  
**Fallback Implemented:** SQLite + `aiosqlite`  
**Isolation:** The SQLite configuration is strictly isolated in `backend/app/persistence/database.py`. The domain models (`backend/app/domain/models/database.py`) use standard SQLAlchemy ORM abstractions, keeping the domain logic database-agnostic.  
**Status:** The system runs effectively on SQLite for the prototype. The Postgres deployment requires an environment with an accessible PostgreSQL server.

## 2. Optimization Engine

**Documented Target:** Google OR-Tools (CP-SAT / linear solver)  
**Current Environment:** Windows Application Control policy (`[WinError 4551]`) blocks the loading of the `ortools` native C++ DLLs (via `ctypes`).  
**Fallback Implemented:** Deterministic custom heuristic algorithm.  
**Isolation:** The heuristic is contained entirely within `backend/app/optimization/optimizer.py`. The interface (`OptimizationEngine.generate_strategy`) strictly matches the documented architecture, taking a versioned snapshot and returning standard structured allocation metrics. The fallback respects all constraints (road blockages, available capacities, typed medicines).  
**Status:** BLOCKED BY ENVIRONMENT. OR-Tools cannot be used without disabling Windows security policies. The fallback is active.
