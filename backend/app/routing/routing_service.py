"""
ReliefOS — Routing Service
Road-network graph routing using Dijkstra's algorithm.
BR-007: Must use network distance, never straight-line distance.
BR-006: Blocked edges excluded from routes.
"""
import heapq
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class RouteResult:
    """Result of a routing calculation."""
    feasible: bool
    node_ids: List[str]        # ordered list of RoadNode IDs
    distance_km: float
    travel_min: float
    risk_score: float
    edge_ids: List[str]
    reason: Optional[str] = None  # infeasibility reason


class RoutingService:
    """
    Road-network routing using Dijkstra.
    Works on an in-memory snapshot of road nodes/edges.
    Never uses straight-line/geographic distance.
    """

    def __init__(self):
        # Adjacency: node_id -> list of (neighbor_id, edge_id, distance_km, travel_min, risk, status)
        self._adj: Dict[str, List[Tuple]] = {}
        self._nodes: Dict[str, dict] = {}  # node_id -> node data
        self._edges: Dict[str, dict] = {}  # edge_id -> edge data

    def build_graph(self, nodes: List[dict], edges: List[dict]) -> None:
        """Build the routing graph from scenario data."""
        self._adj = {}
        self._nodes = {}
        self._edges = {}

        for node in nodes:
            nid = node["id"]
            self._nodes[nid] = node
            self._adj[nid] = []

        for edge in edges:
            eid = edge["id"]
            self._edges[eid] = edge
            frm = edge["from_node_id"]
            to = edge["to_node_id"]
            dist = edge["distance_km"]
            travel = edge["base_travel_min"]
            risk = edge.get("risk_score", 0.0)
            status = edge.get("status", "open")

            if frm in self._adj:
                self._adj[frm].append((to, eid, dist, travel, risk, status))
            # Road edges are bidirectional in the demo scenario
            if to not in self._adj:
                self._adj[to] = []
            self._adj[to].append((frm, eid, dist, travel, risk, status))

    def find_route(
        self,
        from_node_id: str,
        to_node_id: str,
        weight: str = "travel_min",   # "travel_min" | "distance_km" | "risk_weighted"
        exclude_blocked: bool = True,
    ) -> RouteResult:
        """
        Find the shortest feasible route between two road nodes.
        Uses Dijkstra's algorithm.

        Args:
            from_node_id: Source road node ID
            to_node_id: Destination road node ID
            weight: Metric to minimize
            exclude_blocked: If True, BLOCKED edges are excluded (BR-006)

        Returns:
            RouteResult with feasibility flag and route details
        """
        if from_node_id == to_node_id:
            return RouteResult(
                feasible=True,
                node_ids=[from_node_id],
                distance_km=0.0,
                travel_min=0.0,
                risk_score=0.0,
                edge_ids=[],
            )

        if from_node_id not in self._adj:
            return RouteResult(
                feasible=False,
                node_ids=[],
                distance_km=0.0,
                travel_min=0.0,
                risk_score=0.0,
                edge_ids=[],
                reason=f"Source node {from_node_id} not in graph",
            )

        if to_node_id not in self._adj:
            return RouteResult(
                feasible=False,
                node_ids=[],
                distance_km=0.0,
                travel_min=0.0,
                risk_score=0.0,
                edge_ids=[],
                reason=f"Destination node {to_node_id} not in graph",
            )

        # Dijkstra
        # dist_map: node_id -> (cost, distance_km, travel_min, total_risk, [path_nodes], [path_edges])
        INF = float("inf")
        dist_map: Dict[str, float] = {nid: INF for nid in self._adj}
        dist_map[from_node_id] = 0.0

        detail_map: Dict[str, Tuple] = {
            nid: (INF, 0.0, 0.0, 0.0, [], []) for nid in self._adj
        }
        detail_map[from_node_id] = (0.0, 0.0, 0.0, 0.0, [from_node_id], [])

        heap = [(0.0, from_node_id)]
        visited = set()

        while heap:
            cost, node = heapq.heappop(heap)
            if node in visited:
                continue
            visited.add(node)

            if node == to_node_id:
                break

            cur = detail_map[node]
            cur_cost, cur_dist, cur_travel, cur_risk, cur_path, cur_edges = cur

            for (neighbor, edge_id, dist, travel, risk, status) in self._adj.get(node, []):
                # BR-006: Skip blocked roads
                if exclude_blocked and status == "blocked":
                    continue

                # Compute edge weight
                if weight == "distance_km":
                    edge_cost = dist
                elif weight == "risk_weighted":
                    # High risk multiplies travel time
                    edge_cost = travel * (1.0 + risk * 2.0)
                else:  # travel_min (default)
                    edge_cost = travel
                    if status == "high_risk":
                        edge_cost *= 1.5  # Slow down on risky roads

                new_cost = cur_cost + edge_cost
                if new_cost < dist_map[neighbor]:
                    dist_map[neighbor] = new_cost
                    detail_map[neighbor] = (
                        new_cost,
                        cur_dist + dist,
                        cur_travel + travel,
                        cur_risk + risk,
                        cur_path + [neighbor],
                        cur_edges + [edge_id],
                    )
                    heapq.heappush(heap, (new_cost, neighbor))

        final = detail_map.get(to_node_id)
        if final is None or final[0] == INF:
            return RouteResult(
                feasible=False,
                node_ids=[],
                distance_km=0.0,
                travel_min=0.0,
                risk_score=0.0,
                edge_ids=[],
                reason=f"No feasible route from {from_node_id} to {to_node_id} (all paths blocked or disconnected)",
            )

        _, total_dist, total_travel, total_risk, path_nodes, path_edges = final
        n_edges = len(path_edges)
        avg_risk = total_risk / n_edges if n_edges > 0 else 0.0

        return RouteResult(
            feasible=True,
            node_ids=path_nodes,
            distance_km=round(total_dist, 2),
            travel_min=round(total_travel, 2),
            risk_score=round(avg_risk, 3),
            edge_ids=path_edges,
        )

    def find_multi_route(
        self,
        from_node_id: str,
        to_node_ids: List[str],
        weight: str = "travel_min",
    ) -> Dict[str, RouteResult]:
        """Find routes from one source to multiple destinations."""
        return {
            to_id: self.find_route(from_node_id, to_id, weight)
            for to_id in to_node_ids
        }

    def recalculate_affected_routes(
        self,
        blocked_edge_id: str,
        active_route_edge_lists: List[Tuple[str, List[str]]],  # (alloc_id, edge_ids)
    ) -> List[str]:
        """
        Given a newly blocked edge, return IDs of allocations whose routes use that edge.
        """
        affected = []
        for alloc_id, edge_ids in active_route_edge_lists:
            if blocked_edge_id in edge_ids:
                affected.append(alloc_id)
        return affected

    def get_node_count(self) -> int:
        return len(self._nodes)

    def get_edge_count(self) -> int:
        return len(self._edges)
