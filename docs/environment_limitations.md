# Environment Limitations and Fallbacks

This document outlines legitimate infrastructure limitations encountered in the current environment and the isolated fallback mechanisms implemented to ensure the prototype runs while preserving the documented target architecture.

## 1. Database Infrastructure

**Documented Target:** PostgreSQL + PostGIS  
**Current Environment:** Local Windows environment without PostgreSQL installed, no Docker available to run a PostgreSQL container.  
**Fallback Implemented:** SQLite + `aiosqlite`  
**Isolation:** The SQLite configuration is strictly isolated in `backend/app/persistence/database.py`. The domain models (`backend/app/domain/models/database.py`) use standard SQLAlchemy ORM abstractions, keeping the domain logic database-agnostic.  
**Status:** The system runs effectively on SQLite for the prototype. The Postgres deployment requires an environment with an accessible PostgreSQL server.

## 2. Optimization Engine

**Historical target:** Google OR-Tools (CP-SAT / linear solver).
**Current implementation:** Deterministic successive-shortest-path min-cost flow in `backend/app/optimization/optimizer.py`; OR-Tools is not a runtime dependency.
**Behavior:** The optimizer runs across shared supply and demand capacities, supports residual-path reassignment, and uses severity, urgency, shortage pressure, synthetic route ETA and route risk in assignment costs. Availability, typed-medicine reserves, ICU capacity and feasible road-network routes remain hard constraints.
**Status:** The custom solver is the active implementation, not an environment fallback. The earlier Windows native-DLL limitation explains why the original OR-Tools target was not retained; it does not block the current solver.
