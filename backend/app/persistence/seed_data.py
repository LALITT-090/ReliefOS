"""
ReliefOS — Urban Flood Scenario Seed Data
Deterministic seed for the primary demo scenario.
TASK-015, NFR-001: Scenario reset produces identical baseline.
BR-016: Primary demo scenario is reproducible.

This is a SIMULATED scenario with synthetic data.
"""
import uuid
from datetime import datetime, timezone

# Fixed UUIDs for determinism (seed = 42)
SCENARIO_ID = "00000000-0000-0000-0000-000000000001"

# Road node IDs
NODE_IDS = {
    "N01": "11000000-0000-0000-0000-000000000001",
    "N02": "11000000-0000-0000-0000-000000000002",
    "N03": "11000000-0000-0000-0000-000000000003",
    "N04": "11000000-0000-0000-0000-000000000004",
    "N05": "11000000-0000-0000-0000-000000000005",
    "N06": "11000000-0000-0000-0000-000000000006",
    "N07": "11000000-0000-0000-0000-000000000007",
    "N08": "11000000-0000-0000-0000-000000000008",
    "N09": "11000000-0000-0000-0000-000000000009",
    "N10": "11000000-0000-0000-0000-000000000010",
    "N11": "11000000-0000-0000-0000-000000000011",
    "N12": "11000000-0000-0000-0000-000000000012",
}

# Zone IDs (connected to road nodes)
ZONE_IDS = {
    "ZONE_A": "22000000-0000-0000-0000-000000000001",
    "ZONE_B": "22000000-0000-0000-0000-000000000002",
    "ZONE_C": "22000000-0000-0000-0000-000000000003",
    "ZONE_D": "22000000-0000-0000-0000-000000000004",
    "ZONE_E": "22000000-0000-0000-0000-000000000005",
}

# Hospital IDs
HOSP_IDS = {
    "H1": "33000000-0000-0000-0000-000000000001",
    "H2": "33000000-0000-0000-0000-000000000002",
    "H3": "33000000-0000-0000-0000-000000000003",
    "H4": "33000000-0000-0000-0000-000000000004",
}

# Resource source IDs
SOURCE_IDS = {
    "WAREHOUSE_1": "44000000-0000-0000-0000-000000000001",
    "WAREHOUSE_2": "44000000-0000-0000-0000-000000000002",
    "WAREHOUSE_3": "44000000-0000-0000-0000-000000000003",
    "STATION_1": "44000000-0000-0000-0000-000000000004",
    "STATION_2": "44000000-0000-0000-0000-000000000005",
}

# Medicine type IDs
MED_IDS = {
    "ANTIBIOTIC": "55000000-0000-0000-0000-000000000001",
    "ANALGESIC": "55000000-0000-0000-0000-000000000002",
    "IV_FLUID": "55000000-0000-0000-0000-000000000003",
    "EMERGENCY": "55000000-0000-0000-0000-000000000004",
}

# Ambulance IDs
AMB_IDS = {f"AMB_{i:02d}": f"66000000-0000-0000-0000-{i:012d}" for i in range(1, 13)}

# Road edge IDs
EDGE_IDS = {
    f"E{i:02d}": f"77000000-0000-0000-0000-{i:012d}" for i in range(1, 25)
}

# Medicine inventory IDs
INV_IDS = {
    f"INV_{i:02d}": f"88000000-0000-0000-0000-{i:012d}" for i in range(1, 10)
}

# Demand IDs
DEMAND_IDS = {
    f"DEM_{i:02d}": f"99000000-0000-0000-0000-{i:012d}" for i in range(1, 17)
}

def get_seed_data() -> dict:
    """
    Returns the complete Urban Flood scenario seed data.
    Identical on every call — deterministic.
    """
    now = datetime.now(timezone.utc).isoformat()

    return {
        "scenario": {
            "id": SCENARIO_ID,
            "name": "Urban Flood — Metro District",
            "disaster_type": "urban_flood",
            "description": "Simulated urban flooding affecting 5 metro zones. Synthetic demo data only.",
            "status": "inactive",
            "seed": 42,
            "state_version": 1,
        },

        # ── Road nodes ──────────────────────────────────────────────────────
        # A 12-node road graph covering the simulated metro area
        # Coordinates are in the Mumbai/Pune area approximation (synthetic)
        "road_nodes": [
            {"id": NODE_IDS["N01"], "name": "Central Hub",       "lat": 18.5204, "lon": 73.8567},
            {"id": NODE_IDS["N02"], "name": "North Junction",     "lat": 18.5350, "lon": 73.8600},
            {"id": NODE_IDS["N03"], "name": "East Corridor",      "lat": 18.5200, "lon": 73.8750},
            {"id": NODE_IDS["N04"], "name": "South Bypass",       "lat": 18.5050, "lon": 73.8580},
            {"id": NODE_IDS["N05"], "name": "West Gateway",       "lat": 18.5200, "lon": 73.8400},
            {"id": NODE_IDS["N06"], "name": "Zone A Node",        "lat": 18.5400, "lon": 73.8400},
            {"id": NODE_IDS["N07"], "name": "Zone B Node",        "lat": 18.5450, "lon": 73.8700},
            {"id": NODE_IDS["N08"], "name": "Hospital H1 Node",   "lat": 18.5300, "lon": 73.8480},
            {"id": NODE_IDS["N09"], "name": "Hospital H2 Node",   "lat": 18.5280, "lon": 73.8750},
            {"id": NODE_IDS["N10"], "name": "Zone C Node",        "lat": 18.5100, "lon": 73.8700},
            {"id": NODE_IDS["N11"], "name": "Zone D Node",        "lat": 18.5000, "lon": 73.8450},
            {"id": NODE_IDS["N12"], "name": "Zone E / S Hub",     "lat": 18.4900, "lon": 73.8600},
        ],

        # ── Road edges ──────────────────────────────────────────────────────
        # Bidirectional road connections. Status can be OPEN/HIGH_RISK/BLOCKED.
        "road_edges": [
            # Central Hub connections
            {"id": EDGE_IDS["E01"], "from_node_id": NODE_IDS["N01"], "to_node_id": NODE_IDS["N02"],
             "name": "Central-North Rd", "distance_km": 1.8, "base_travel_min": 6.0, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E02"], "from_node_id": NODE_IDS["N01"], "to_node_id": NODE_IDS["N03"],
             "name": "Central-East Rd", "distance_km": 2.1, "base_travel_min": 8.0, "risk_score": 0.3, "status": "high_risk"},
            {"id": EDGE_IDS["E03"], "from_node_id": NODE_IDS["N01"], "to_node_id": NODE_IDS["N04"],
             "name": "Central-South Rd", "distance_km": 1.9, "base_travel_min": 7.0, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E04"], "from_node_id": NODE_IDS["N01"], "to_node_id": NODE_IDS["N05"],
             "name": "Central-West Rd", "distance_km": 1.5, "base_travel_min": 5.0, "risk_score": 0.0, "status": "open"},

            # North area
            {"id": EDGE_IDS["E05"], "from_node_id": NODE_IDS["N02"], "to_node_id": NODE_IDS["N06"],
             "name": "North-ZoneA Rd", "distance_km": 1.2, "base_travel_min": 5.0, "risk_score": 0.2, "status": "open"},
            {"id": EDGE_IDS["E06"], "from_node_id": NODE_IDS["N02"], "to_node_id": NODE_IDS["N07"],
             "name": "North-ZoneB Rd", "distance_km": 1.4, "base_travel_min": 6.0, "risk_score": 0.3, "status": "open"},
            {"id": EDGE_IDS["E07"], "from_node_id": NODE_IDS["N02"], "to_node_id": NODE_IDS["N08"],
             "name": "North-H1 Rd", "distance_km": 1.0, "base_travel_min": 4.0, "risk_score": 0.0, "status": "open"},

            # West-North hub to hospital
            {"id": EDGE_IDS["E08"], "from_node_id": NODE_IDS["N05"], "to_node_id": NODE_IDS["N06"],
             "name": "West-ZoneA Rd", "distance_km": 1.3, "base_travel_min": 5.5, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E09"], "from_node_id": NODE_IDS["N05"], "to_node_id": NODE_IDS["N08"],
             "name": "West-H1 Rd", "distance_km": 0.9, "base_travel_min": 4.0, "risk_score": 0.0, "status": "open"},

            # East connections
            {"id": EDGE_IDS["E10"], "from_node_id": NODE_IDS["N03"], "to_node_id": NODE_IDS["N07"],
             "name": "East-ZoneB Rd", "distance_km": 1.1, "base_travel_min": 5.0, "risk_score": 0.4, "status": "high_risk"},
            {"id": EDGE_IDS["E11"], "from_node_id": NODE_IDS["N03"], "to_node_id": NODE_IDS["N09"],
             "name": "East-H2 Rd", "distance_km": 1.3, "base_travel_min": 5.5, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E12"], "from_node_id": NODE_IDS["N03"], "to_node_id": NODE_IDS["N10"],
             "name": "East-ZoneC Rd", "distance_km": 1.5, "base_travel_min": 6.5, "risk_score": 0.5, "status": "high_risk"},

            # South connections
            {"id": EDGE_IDS["E13"], "from_node_id": NODE_IDS["N04"], "to_node_id": NODE_IDS["N10"],
             "name": "South-ZoneC Rd", "distance_km": 1.7, "base_travel_min": 7.0, "risk_score": 0.2, "status": "open"},
            {"id": EDGE_IDS["E14"], "from_node_id": NODE_IDS["N04"], "to_node_id": NODE_IDS["N11"],
             "name": "South-ZoneD Rd", "distance_km": 1.4, "base_travel_min": 6.0, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E15"], "from_node_id": NODE_IDS["N04"], "to_node_id": NODE_IDS["N12"],
             "name": "South-ZoneE Rd", "distance_km": 1.8, "base_travel_min": 7.5, "risk_score": 0.2, "status": "open"},

            # Zone C to Hospital H3/H4
            {"id": EDGE_IDS["E16"], "from_node_id": NODE_IDS["N10"], "to_node_id": NODE_IDS["N09"],
             "name": "ZoneC-H2 Link", "distance_km": 1.2, "base_travel_min": 5.0, "risk_score": 0.3, "status": "open"},

            # Zone D-E connections
            {"id": EDGE_IDS["E17"], "from_node_id": NODE_IDS["N11"], "to_node_id": NODE_IDS["N12"],
             "name": "ZoneD-ZoneE Rd", "distance_km": 1.0, "base_travel_min": 4.5, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E18"], "from_node_id": NODE_IDS["N12"], "to_node_id": NODE_IDS["N04"],
             "name": "ZoneE-South Bypass", "distance_km": 1.6, "base_travel_min": 6.5, "risk_score": 0.2, "status": "open"},

            # Additional connectivity
            {"id": EDGE_IDS["E19"], "from_node_id": NODE_IDS["N08"], "to_node_id": NODE_IDS["N09"],
             "name": "H1-H2 Corridor", "distance_km": 2.8, "base_travel_min": 10.0, "risk_score": 0.1, "status": "open"},
            {"id": EDGE_IDS["E20"], "from_node_id": NODE_IDS["N06"], "to_node_id": NODE_IDS["N07"],
             "name": "ZoneA-ZoneB Link", "distance_km": 2.0, "base_travel_min": 8.0, "risk_score": 0.4, "status": "high_risk"},
        ],

        # ── Zones (5 affected zones) ─────────────────────────────────────────
        "zones": [
            {
                "id": ZONE_IDS["ZONE_A"],
                "name": "Zone A — Riverside District",
                "lat": 18.5400, "lon": 73.8400,
                "severity": "critical",
                "affected_population": 2500,
                "status": "active",
                "road_node_id": NODE_IDS["N06"],
            },
            {
                "id": ZONE_IDS["ZONE_B"],
                "name": "Zone B — Central Market",
                "lat": 18.5450, "lon": 73.8700,
                "severity": "high",
                "affected_population": 1800,
                "status": "active",
                "road_node_id": NODE_IDS["N07"],
            },
            {
                "id": ZONE_IDS["ZONE_C"],
                "name": "Zone C — Eastern Suburb",
                "lat": 18.5100, "lon": 73.8700,
                "severity": "high",
                "affected_population": 1200,
                "status": "active",
                "road_node_id": NODE_IDS["N10"],
            },
            {
                "id": ZONE_IDS["ZONE_D"],
                "name": "Zone D — Southern Colony",
                "lat": 18.5000, "lon": 73.8450,
                "severity": "medium",
                "affected_population": 900,
                "status": "active",
                "road_node_id": NODE_IDS["N11"],
            },
            {
                "id": ZONE_IDS["ZONE_E"],
                "name": "Zone E — Industrial Zone",
                "lat": 18.4900, "lon": 73.8600,
                "severity": "medium",
                "affected_population": 600,
                "status": "active",
                "road_node_id": NODE_IDS["N12"],
            },
        ],

        # ── Hospitals (4 hospitals) ──────────────────────────────────────────
        "hospitals": [
            {
                "id": HOSP_IDS["H1"],
                "name": "City General Hospital",
                "lat": 18.5300, "lon": 73.8480,
                "beds_total": 200, "beds_available": 45,
                "icu_total": 30, "icu_available": 18,
                "status": "operational",
                "road_node_id": NODE_IDS["N08"],
            },
            {
                "id": HOSP_IDS["H2"],
                "name": "Metro Medical Center",
                "lat": 18.5280, "lon": 73.8750,
                "beds_total": 150, "beds_available": 30,
                "icu_total": 20, "icu_available": 12,
                "status": "operational",
                "road_node_id": NODE_IDS["N09"],
            },
            {
                "id": HOSP_IDS["H3"],
                "name": "Northern Relief Hospital",
                "lat": 18.5350, "lon": 73.8600,
                "beds_total": 80, "beds_available": 20,
                "icu_total": 10, "icu_available": 6,
                "status": "operational",
                "road_node_id": NODE_IDS["N02"],
            },
            {
                "id": HOSP_IDS["H4"],
                "name": "Southern District Clinic",
                "lat": 18.4950, "lon": 73.8500,
                "beds_total": 60, "beds_available": 15,
                "icu_total": 8, "icu_available": 5,
                "status": "operational",
                "road_node_id": NODE_IDS["N04"],
            },
        ],

        # ── Resource Sources (3 warehouses + 2 ambulance stations) ──────────
        "resource_sources": [
            {
                "id": SOURCE_IDS["WAREHOUSE_1"],
                "name": "Central Medical Warehouse",
                "type": "warehouse",
                "lat": 18.5204, "lon": 73.8567,
                "status": "active",
                "road_node_id": NODE_IDS["N01"],
            },
            {
                "id": SOURCE_IDS["WAREHOUSE_2"],
                "name": "North Supply Depot",
                "type": "warehouse",
                "lat": 18.5350, "lon": 73.8600,
                "status": "active",
                "road_node_id": NODE_IDS["N02"],
            },
            {
                "id": SOURCE_IDS["WAREHOUSE_3"],
                "name": "East Medical Cache",
                "type": "warehouse",
                "lat": 18.5200, "lon": 73.8750,
                "status": "active",
                "road_node_id": NODE_IDS["N03"],
            },
            {
                "id": SOURCE_IDS["STATION_1"],
                "name": "Ambulance Station Alpha",
                "type": "ambulance_station",
                "lat": 18.5200, "lon": 73.8400,
                "status": "active",
                "road_node_id": NODE_IDS["N05"],
            },
            {
                "id": SOURCE_IDS["STATION_2"],
                "name": "Ambulance Station Beta",
                "type": "ambulance_station",
                "lat": 18.5350, "lon": 73.8600,
                "status": "active",
                "road_node_id": NODE_IDS["N02"],
            },
        ],

        # ── Medicine types ──────────────────────────────────────────────────
        "medicine_types": [
            {"id": MED_IDS["ANTIBIOTIC"], "code": "ANTIBIOTIC", "name": "Antibiotics", "unit": "vials"},
            {"id": MED_IDS["ANALGESIC"], "code": "ANALGESIC", "name": "Analgesics (Pain Relief)", "unit": "doses"},
            {"id": MED_IDS["IV_FLUID"], "code": "IV_FLUID", "name": "IV Fluids", "unit": "liters"},
            {"id": MED_IDS["EMERGENCY"], "code": "EMERGENCY", "name": "Emergency Medications", "unit": "kits"},
        ],

        # ── Medicine inventory ───────────────────────────────────────────────
        "medicine_inventory": [
            # Warehouse 1 — Central
            {"id": INV_IDS["INV_01"], "source_id": SOURCE_IDS["WAREHOUSE_1"], "medicine_type_id": MED_IDS["ANTIBIOTIC"],
             "quantity_available": 120, "reserve_quantity": 20},
            {"id": INV_IDS["INV_02"], "source_id": SOURCE_IDS["WAREHOUSE_1"], "medicine_type_id": MED_IDS["ANALGESIC"],
             "quantity_available": 200, "reserve_quantity": 30},
            {"id": INV_IDS["INV_03"], "source_id": SOURCE_IDS["WAREHOUSE_1"], "medicine_type_id": MED_IDS["IV_FLUID"],
             "quantity_available": 80, "reserve_quantity": 10},
            {"id": INV_IDS["INV_04"], "source_id": SOURCE_IDS["WAREHOUSE_1"], "medicine_type_id": MED_IDS["EMERGENCY"],
             "quantity_available": 50, "reserve_quantity": 10},

            # Warehouse 2 — North
            {"id": INV_IDS["INV_05"], "source_id": SOURCE_IDS["WAREHOUSE_2"], "medicine_type_id": MED_IDS["ANTIBIOTIC"],
             "quantity_available": 80, "reserve_quantity": 15},
            {"id": INV_IDS["INV_06"], "source_id": SOURCE_IDS["WAREHOUSE_2"], "medicine_type_id": MED_IDS["IV_FLUID"],
             "quantity_available": 60, "reserve_quantity": 10},
            {"id": INV_IDS["INV_07"], "source_id": SOURCE_IDS["WAREHOUSE_2"], "medicine_type_id": MED_IDS["EMERGENCY"],
             "quantity_available": 30, "reserve_quantity": 5},

            # Warehouse 3 — East
            {"id": INV_IDS["INV_08"], "source_id": SOURCE_IDS["WAREHOUSE_3"], "medicine_type_id": MED_IDS["ANALGESIC"],
             "quantity_available": 150, "reserve_quantity": 25},
            {"id": INV_IDS["INV_09"], "source_id": SOURCE_IDS["WAREHOUSE_3"], "medicine_type_id": MED_IDS["IV_FLUID"],
             "quantity_available": 40, "reserve_quantity": 5},
        ],

        # ── Ambulances (12 ambulances) ──────────────────────────────────────
        "ambulances": [
            # Station Alpha (6 ambulances)
            {"id": AMB_IDS["AMB_01"], "name": "A-01", "lat": 18.5200, "lon": 73.8400,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N05"]},
            {"id": AMB_IDS["AMB_02"], "name": "A-02", "lat": 18.5200, "lon": 73.8400,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N05"]},
            {"id": AMB_IDS["AMB_03"], "name": "A-03", "lat": 18.5200, "lon": 73.8400,
             "capacity": 4, "availability_status": "available", "road_node_id": NODE_IDS["N05"]},
            {"id": AMB_IDS["AMB_04"], "name": "A-04", "lat": 18.5200, "lon": 73.8400,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N05"]},
            {"id": AMB_IDS["AMB_05"], "name": "A-05", "lat": 18.5200, "lon": 73.8400,
             "capacity": 2, "availability_status": "in_transit", "road_node_id": NODE_IDS["N05"]},
            {"id": AMB_IDS["AMB_06"], "name": "A-06", "lat": 18.5200, "lon": 73.8400,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N05"]},

            # Station Beta (6 ambulances)
            {"id": AMB_IDS["AMB_07"], "name": "B-07", "lat": 18.5350, "lon": 73.8600,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N02"]},
            {"id": AMB_IDS["AMB_08"], "name": "B-08", "lat": 18.5350, "lon": 73.8600,
             "capacity": 4, "availability_status": "available", "road_node_id": NODE_IDS["N02"]},
            {"id": AMB_IDS["AMB_09"], "name": "B-09", "lat": 18.5350, "lon": 73.8600,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N02"]},
            {"id": AMB_IDS["AMB_10"], "name": "B-10", "lat": 18.5350, "lon": 73.8600,
             "capacity": 2, "availability_status": "unavailable", "road_node_id": NODE_IDS["N02"]},
            {"id": AMB_IDS["AMB_11"], "name": "B-11", "lat": 18.5350, "lon": 73.8600,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N02"]},
            {"id": AMB_IDS["AMB_12"], "name": "B-12", "lat": 18.5350, "lon": 73.8600,
             "capacity": 2, "availability_status": "available", "road_node_id": NODE_IDS["N02"]},
        ],

        # ── Demands ─────────────────────────────────────────────────────────
        "demands": [
            # Zone A — Critical
            {"id": DEMAND_IDS["DEM_01"], "zone_id": ZONE_IDS["ZONE_A"], "resource_type": "ambulance",
             "quantity": 4, "severity": "critical", "urgency": "immediate"},
            {"id": DEMAND_IDS["DEM_02"], "zone_id": ZONE_IDS["ZONE_A"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["EMERGENCY"], "quantity": 20, "severity": "critical", "urgency": "immediate"},
            {"id": DEMAND_IDS["DEM_03"], "zone_id": ZONE_IDS["ZONE_A"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["IV_FLUID"], "quantity": 15, "severity": "critical", "urgency": "immediate"},
            {"id": DEMAND_IDS["DEM_04"], "zone_id": ZONE_IDS["ZONE_A"], "resource_type": "icu_bed",
             "quantity": 8, "severity": "critical", "urgency": "immediate"},

            # Zone B — High
            {"id": DEMAND_IDS["DEM_05"], "zone_id": ZONE_IDS["ZONE_B"], "resource_type": "ambulance",
             "quantity": 3, "severity": "high", "urgency": "urgent"},
            {"id": DEMAND_IDS["DEM_06"], "zone_id": ZONE_IDS["ZONE_B"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["ANTIBIOTIC"], "quantity": 30, "severity": "high", "urgency": "urgent"},
            {"id": DEMAND_IDS["DEM_07"], "zone_id": ZONE_IDS["ZONE_B"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["ANALGESIC"], "quantity": 40, "severity": "high", "urgency": "urgent"},
            {"id": DEMAND_IDS["DEM_08"], "zone_id": ZONE_IDS["ZONE_B"], "resource_type": "icu_bed",
             "quantity": 5, "severity": "high", "urgency": "urgent"},

            # Zone C — High
            {"id": DEMAND_IDS["DEM_09"], "zone_id": ZONE_IDS["ZONE_C"], "resource_type": "ambulance",
             "quantity": 2, "severity": "high", "urgency": "urgent"},
            {"id": DEMAND_IDS["DEM_10"], "zone_id": ZONE_IDS["ZONE_C"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["ANTIBIOTIC"], "quantity": 20, "severity": "high", "urgency": "urgent"},
            {"id": DEMAND_IDS["DEM_11"], "zone_id": ZONE_IDS["ZONE_C"], "resource_type": "icu_bed",
             "quantity": 4, "severity": "high", "urgency": "urgent"},

            # Zone D — Medium
            {"id": DEMAND_IDS["DEM_12"], "zone_id": ZONE_IDS["ZONE_D"], "resource_type": "ambulance",
             "quantity": 2, "severity": "medium", "urgency": "urgent"},
            {"id": DEMAND_IDS["DEM_13"], "zone_id": ZONE_IDS["ZONE_D"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["ANALGESIC"], "quantity": 25, "severity": "medium", "urgency": "routine"},
            {"id": DEMAND_IDS["DEM_14"], "zone_id": ZONE_IDS["ZONE_D"], "resource_type": "icu_bed",
             "quantity": 2, "severity": "medium", "urgency": "urgent"},

            # Zone E — Medium
            {"id": DEMAND_IDS["DEM_15"], "zone_id": ZONE_IDS["ZONE_E"], "resource_type": "ambulance",
             "quantity": 1, "severity": "medium", "urgency": "routine"},
            {"id": DEMAND_IDS["DEM_16"], "zone_id": ZONE_IDS["ZONE_E"], "resource_type": "medicine",
             "medicine_type_id": MED_IDS["IV_FLUID"], "quantity": 10, "severity": "medium", "urgency": "routine"},
        ],
    }


# Scripted chaos events for the primary demo (deterministic)
SCRIPTED_EVENTS = [
    {
        "step": 1,
        "name": "Road Block — Central-East Road",
        "event_type": "road_block",
        "payload": {"edge_id": EDGE_IDS["E02"]},
        "description": "Central-East Road flooded and blocked.",
    },
    {
        "step": 2,
        "name": "Hospital Overload — Metro Medical Center",
        "event_type": "hospital_overload",
        "payload": {"hospital_id": HOSP_IDS["H2"], "icu_reduction": 8},
        "description": "Surge of patients reduces ICU availability at H2 by 8.",
    },
    {
        "step": 3,
        "name": "Vehicle Failure — Ambulance B-10",
        "event_type": "vehicle_failure",
        "payload": {"ambulance_id": AMB_IDS["AMB_10"]},
        "description": "Ambulance B-10 breakdown reported.",
    },
    {
        "step": 4,
        "name": "Demand Spike — Zone A",
        "event_type": "demand_spike",
        "payload": {
            "zone_id": ZONE_IDS["ZONE_A"],
            "resource_type": "ambulance",
            "increase_amount": 3,
        },
        "description": "Building collapse in Zone A increases ambulance demand by 3.",
    },
    {
        "step": 5,
        "name": "Medicine Shortage — North Warehouse Antibiotics",
        "event_type": "medicine_shortage",
        "payload": {
            "inventory_id": INV_IDS["INV_05"],
            "reduction": 50,
        },
        "description": "North Warehouse antibiotic stock partially contaminated.",
    },
    {
        "step": 6,
        "name": "New Incident Zone — F (Port Area)",
        "event_type": "new_incident_zone",
        "payload": {
            "name": "Zone F — Port Area",
            "lat": 18.4800,
            "lon": 73.8700,
            "severity": "high",
            "affected_population": 800,
            "demands": [
                {"resource_type": "ambulance", "quantity": 2, "severity": "high", "urgency": "urgent"},
                {"resource_type": "medicine", "medicine_type_id": MED_IDS["IV_FLUID"],
                 "quantity": 8, "severity": "high", "urgency": "urgent"},
            ],
        },
        "description": "Port area flooding creates new incident zone F.",
    },
]
