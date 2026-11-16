
import copy

from simulation.network import generate_network
from simulation.simulation_engine import WSNSimulationEngine

from simulation.algorithms.dijkstra_routing import DijkstraRouting
from simulation.algorithms.ilp_routing import ILPRouting
from simulation.algorithms.ga_routing import GARouting
from simulation.algorithms.pso_routing import PSORouting
from simulation.algorithms.aco_routing import ACORouting
from simulation.algorithms.ann_routing import ANNRouting


class MultiAlgorithmSimulationRunner:
    """
    Runs six multi-hop routing algorithms.

    ANN is used exclusively for cluster-head selection.

    All six algorithms:
        - Start from the same initial network deployment.
        - Use independent network copies.
        - Maintain independent residual-energy histories.
        - Use the same simulation and radio configuration.
    """

    def __init__(self, config):
        self.config = copy.deepcopy(config)

        communication = self.config.get("communication", {})

        self.communication_range = float(
            communication.get("communication_range_m") or 60
        )

        if self.communication_range <= 0:
            raise ValueError(
                "Communication range must be positive."
            )

        # Generate the deployment only once.
        self.initial_network = generate_network(
            self.config,
            self.communication_range
        )

        # Moderate optimization settings for the first benchmark.
        # These can be increased after measuring runtime.
        self.algorithm_factories = {
            "Dijkstra": lambda: DijkstraRouting(),

            "ILP": lambda: ILPRouting(),

            "GA": lambda: GARouting(
                population_size=20,
                generations=20,
                random_seed=42
            ),

            "PSO": lambda: PSORouting(
                swarm_size=20,
                iterations=20,
                random_seed=42
            ),

            "ACO": lambda: ACORouting(
                num_ants=20,
                iterations=20,
                random_seed=42
            ),

            "ANN": lambda: ANNRouting(
                training_samples=5000,
                random_seed=42
            ),
        }

    @staticmethod
    def _build_summary(result):
        history = result["history"]

        if not history:
            return {
                "completed_rounds": 0
            }

        final_metrics = history[-1]["metrics"]

        total_energy_consumed = sum(
            snapshot["metrics"]["energy_consumed"]
            for snapshot in history
        )

        total_successful_normal = sum(
            snapshot["metrics"]["successful_normal_packets"]
            for snapshot in history
        )

        total_lost_normal = sum(
            snapshot["metrics"]["lost_normal_packets"]
            for snapshot in history
        )

        total_successful_ch = sum(
            snapshot["metrics"]["successful_ch_packets"]
            for snapshot in history
        )

        total_lost_ch = sum(
            snapshot["metrics"]["lost_ch_packets"]
            for snapshot in history
        )

        return {
            "completed_rounds": result["total_rounds_completed"],
            "final_alive_nodes": final_metrics["alive_nodes"],
            "final_dead_nodes": final_metrics["dead_nodes"],
            "final_residual_energy": final_metrics[
                "total_residual_energy"
            ],
            "total_energy_consumed": total_energy_consumed,
            "successful_normal_packets": total_successful_normal,
            "lost_normal_packets": total_lost_normal,
            "successful_ch_packets": total_successful_ch,
            "lost_ch_packets": total_lost_ch,
            "final_routing_distance": final_metrics[
                "routing_distance"
            ],
        }

    def run(self, number_of_rounds=1):

        if not isinstance(number_of_rounds, int):
            raise TypeError(
                "Number of rounds must be an integer."
            )

        if number_of_rounds < 1:
            raise ValueError(
                "Number of rounds must be positive."
            )

        algorithm_results = {}
        comparison = []

        for algorithm_key, factory in self.algorithm_factories.items():

            print(
                f"\nRunning {algorithm_key} routing..."
            )

            routing_algorithm = factory()

            engine = WSNSimulationEngine(
                config=self.config,
                routing_algorithm=routing_algorithm,
                initial_network=self.initial_network
            )

            result = engine.run(
                number_of_rounds=number_of_rounds
            )

            result["algorithm_key"] = algorithm_key

            algorithm_results[algorithm_key] = result

            summary = self._build_summary(result)

            comparison.append({
                "algorithm": algorithm_key,
                **summary
            })

            print(
                f"{algorithm_key}: "
                f"{result['total_rounds_completed']} rounds completed."
            )

        return {
            "status": "success",
            "cluster_head_algorithm": "ANN",
            "requested_rounds": number_of_rounds,
            "communication_range": self.communication_range,
            "network_nodes": self.initial_network["num_nodes"],
            "algorithms": list(self.algorithm_factories.keys()),
            "total_algorithms": len(self.algorithm_factories),
            "results": algorithm_results,
            "comparison": comparison
        }
