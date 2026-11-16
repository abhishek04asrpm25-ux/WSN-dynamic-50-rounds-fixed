
import numpy as np
import networkx as nx

from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

from simulation.algorithms.routing_interface import RoutingAlgorithm


class ANNRouting(RoutingAlgorithm):
    """
    ANN-based multi-hop routing.

    The neural network scores possible next hops using:
    1. Residual energy
    2. Distance to the Base Station
    3. Link distance
    4. Node degree
    5. Link quality (LQI)

    Candidate next hops must be closer to the BS in
    shortest-path distance, preventing routing loops.

    Note:
        This prototype uses synthetic training samples with
        heuristic target scores. It is not a model trained
        on measured WSN routing outcomes.
    """

    algorithm_name = "ANN Multi-Hop Routing"

    def __init__(
        self,
        training_samples=5000,
        random_seed=42,
    ):
        self.training_samples = int(training_samples)
        self.random_seed = int(random_seed)

        if self.training_samples < 100:
            raise ValueError("Use at least 100 training samples.")

        self.scaler = StandardScaler()

        self.model = MLPRegressor(
            hidden_layer_sizes=(32, 16),
            activation="relu",
            solver="adam",
            max_iter=500,
            random_state=self.random_seed,
            early_stopping=True,
        )

        self.training_result = self.train()

    def train(self):
        rng = np.random.default_rng(self.random_seed)

        X = rng.uniform(
            0.0,
            1.0,
            size=(self.training_samples, 5),
        )

        energy = X[:, 0]
        distance_to_bs = X[:, 1]
        link_distance = X[:, 2]
        degree = X[:, 3]
        lqi = X[:, 4]

        # Transparent heuristic target used for prototype training.
        y = (
            0.30 * energy
            + 0.25 * (1.0 - distance_to_bs)
            + 0.20 * (1.0 - link_distance)
            + 0.15 * degree
            + 0.10 * lqi
        )

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

        return {
            "training_samples": self.training_samples,
            "training_score": float(self.model.score(X_scaled, y)),
            "label_source": "synthetic heuristic scores",
        }

    @staticmethod
    def _get_residual_energy(graph, node_id):
        return max(
            0.0,
            float(
                graph.nodes[node_id].get(
                    "residual_energy",
                    graph.nodes[node_id].get("energy", 0.5),
                )
            ),
        )

    def _extract_features(
        self,
        graph,
        ch,
        candidate,
        distances,
        max_distance,
        max_edge_distance,
        max_energy,
        max_degree,
    ):
        edge_data = graph[ch][candidate]

        link_distance = max(
            0.0,
            float(edge_data.get("weight", 1.0)),
        )

        residual_energy = self._get_residual_energy(
            graph,
            candidate,
        )

        degree = graph.degree(candidate)

        lqi = float(edge_data.get("lqi", 0.8))
        lqi = max(0.0, min(1.0, lqi))

        return [
            residual_energy / max(max_energy, 1e-9),
            distances[candidate] / max(max_distance, 1e-9),
            link_distance / max(max_edge_distance, 1e-9),
            degree / max(max_degree, 1),
            lqi,
        ]

    def find_routes(self, graph, selected_ch_ids, bs_id="BS"):
        selected_ch_ids = list(selected_ch_ids)

        if not selected_ch_ids:
            return {}

        if bs_id not in graph:
            raise ValueError("Base station is missing from graph.")

        if not nx.is_connected(graph):
            raise ValueError("Routing graph must be connected.")

        distances = nx.single_source_dijkstra_path_length(
            graph,
            bs_id,
            weight="weight",
        )

        max_distance = max(distances.values(), default=1.0)

        max_edge_distance = max(
            (
                float(data.get("weight", 1.0))
                for _, _, data in graph.edges(data=True)
            ),
            default=1.0,
        )

        max_energy = max(
            (
                self._get_residual_energy(graph, node)
                for node in graph.nodes
                if node != bs_id
            ),
            default=1.0,
        )

        max_degree = max(
            (graph.degree(node) for node in graph.nodes),
            default=1,
        )

        parent_map = {}

        for ch in selected_ch_ids:
            if ch not in graph or ch not in distances:
                raise ValueError(f"CH {ch} cannot reach the BS.")

            candidates = [
                neighbor
                for neighbor in graph.neighbors(ch)
                if neighbor in distances
                and distances[neighbor] < distances[ch]
            ]

            if not candidates:
                raise ValueError(
                    f"No valid next hop exists for CH {ch}."
                )

            features = [
                self._extract_features(
                    graph=graph,
                    ch=ch,
                    candidate=candidate,
                    distances=distances,
                    max_distance=max_distance,
                    max_edge_distance=max_edge_distance,
                    max_energy=max_energy,
                    max_degree=max_degree,
                )
                for candidate in candidates
            ]

            X = self.scaler.transform(
                np.asarray(features, dtype=float)
            )

            scores = self.model.predict(X)

            best_index = int(np.argmax(scores))
            parent_map[ch] = candidates[best_index]

        return parent_map
