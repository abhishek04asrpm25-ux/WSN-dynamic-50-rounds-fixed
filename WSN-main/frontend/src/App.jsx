
import { useEffect, useState } from "react";
import NetworkTopology from "./NetworkTopology";
import "./App.css";

const API = "http://127.0.0.1:8000";

const algorithms = ["Dijkstra", "ILP", "GA", "PSO", "ACO", "ANN"];

function App() {
  const [configuration, setConfiguration] = useState(null);
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [activePage, setActivePage] = useState("Dashboard");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("Dijkstra");
  const [message, setMessage] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [rounds, setRounds] = useState(50);
  const [roundIndex, setRoundIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    async function loadConfiguration() {
      try {
        const response = await fetch(`${API}/api/config`);

        if (!response.ok) {
          throw new Error("Configuration request failed.");
        }

        const data = await response.json();

        setConfiguration(data.configuration);
        setBackendStatus("Connected");
      } catch (error) {
        console.error(error);
        setBackendStatus("Disconnected");
      }
    }

    loadConfiguration();
  }, []);

  const network = configuration?.network;
  const simulation = configuration?.simulation;
  const communication = configuration?.communication;
  const ga = configuration?.ga_parameters;

  // Get the selected algorithm's actual backend result.
  const selectedResult =
    simulationResult?.results?.[selectedAlgorithm] ?? null;

  const history = selectedResult?.history ?? [];
  const safeRoundIndex = Math.min(roundIndex, Math.max(history.length - 1, 0));
  const currentRound = history[safeRoundIndex] ?? null;

  // Playback advances through the real backend snapshots, not fabricated values.
  useEffect(() => {
    if (!isPlaying || history.length === 0) return undefined;
    const timer = window.setInterval(() => {
      setRoundIndex((index) => {
        if (index >= history.length - 1) {
          setIsPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [isPlaying, history.length, selectedAlgorithm]);

  // Run all six algorithms through the new FastAPI endpoint.
  async function handleRun() {
    if (backendStatus !== "Connected") {
      setMessage("Please start the Python backend.");
      return;
    }

    try {
      setIsRunning(true);
      setMessage(`Running all six algorithms for ${rounds} round(s)...`);
      setSimulationResult(null);
      setIsPlaying(false);
      setRoundIndex(0);

      const response = await fetch(
        `${API}/api/simulation/run-all?rounds=${rounds}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Multi-algorithm simulation failed."
        );
      }

      if (
        data.status !== "success" ||
        !data.results ||
        !Array.isArray(data.comparison) ||
        data.comparison.length !== 6
      ) {
        throw new Error(
          "The backend did not return all six algorithm results."
        );
      }

      for (const algorithm of algorithms) {
        const algorithmResult = data.results[algorithm];

        if (
          !algorithmResult ||
          !Array.isArray(algorithmResult.history) ||
          algorithmResult.history.length === 0
        ) {
          throw new Error(
            `No simulation history returned for ${algorithm}.`
          );
        }
      }

      setSimulationResult(data);
      setRoundIndex(0);
      setIsPlaying(false);
      setMessage(
        "All six routing algorithms completed successfully!"
      );

    } catch (error) {
      console.error("Simulation error:", error);
      setMessage(`Simulation error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  function handleAlgorithmChange(algorithm) {
    setSelectedAlgorithm(algorithm);
    setRoundIndex(0);
    setIsPlaying(false);
    setMessage("");
  }

  return (
    <div className="wsn-app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">W</div>

          <div>
            <h2>WSN OPTIMIZER</h2>
            <small>Routing Intelligence</small>
          </div>
        </div>

        <p className="sidebar-label">MAIN MENU</p>

        {["Dashboard", "Network", "Routing", "Results", "Settings"].map(
          (item) => (
            <button
              key={item}
              className={`nav-button ${
                activePage === item ? "active" : ""
              }`}
              onClick={() => setActivePage(item)}
            >
              {item}
            </button>
          )
        )}

        <div className="sidebar-status">
          <span
            className={`status-dot ${
              backendStatus === "Connected" ? "online" : ""
            }`}
          />

          <div>
            <strong>Backend {backendStatus}</strong>

            <small>
              {configuration
                ? "Configuration loaded"
                : "Waiting for Python API"}
            </small>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
            <p>Wireless Sensor Network Routing Optimization</p>
          </div>

          <div className="topbar-tag">PYTHON + REACT</div>
        </header>

        {/* DASHBOARD */}
        {activePage === "Dashboard" && (
          <>
            <section className="welcome-section">
              <div>
                <h2>Network Intelligence Dashboard</h2>
                <p>
                  Monitor and compare six multi-hop routing algorithms
                  using ANN-based cluster-head selection.
                </p>
              </div>

              <button
                className="run-button"
                onClick={handleRun}
                disabled={isRunning}
              >
                {isRunning
                  ? "Running All Algorithms..."
                  : "Run All Algorithms"}
              </button>
            </section>

            {message && <div className="message">{message}</div>}

            {/* ROUND SELECTION */}
            <section className="panel">
              <h2>Simulation Control</h2>

              <div className="config-row">
                <span>Number of rounds</span>

                <input
                  type="number"
                  min="1"
                  max="200"
                  value={rounds}
                  disabled={isRunning}
                  onChange={(event) => {
                    const value = Number(event.target.value);

                    if (value >= 1 && value <= 200) {
                      setRounds(value);
                    } else if (event.target.value === "") {
                      setRounds("");
                    }
                  }}
                  onBlur={() => {
                    if (!rounds || rounds < 1) setRounds(1);
                    if (rounds > 200) setRounds(200);
                  }}
                  style={{
                    width: "90px",
                    padding: "8px",
                    borderRadius: "6px",
                  }}
                />
              </div>

              <small>
                All six algorithms use the same initial network deployment
                and independent energy histories.
              </small>
            </section>

            {/* CONFIGURATION METRICS */}
            <section className="metrics-grid">
              <Metric
                title="Sensor Nodes"
                value={network?.num_nodes ?? "—"}
                detail="Python configuration"
              />

              <Metric
                title="Cluster Heads"
                value={simulation?.num_cluster_heads ?? "—"}
                detail="ANN selection"
              />

              <Metric
                title="Algorithms"
                value="6"
                detail="Multi-hop routing"
              />

              <Metric
                title="Initial Energy"
                value={
                  network ? `${network.initial_energy_j} J` : "—"
                }
                detail="Per sensor node"
              />
            </section>

            {/* COMPARISON */}
            {simulationResult && (
              <AlgorithmComparison
                comparison={simulationResult.comparison}
                selectedAlgorithm={selectedAlgorithm}
                onSelect={handleAlgorithmChange}
              />
            )}

            {/* ROUND-BY-ROUND PLAYBACK */}
            {currentRound && selectedResult && (
              <section className="panel" style={{ marginBottom: "22px" }}>
                <h2>Dynamic Round Playback</h2>
                <p>Round <strong>{currentRound.round}</strong> of {selectedResult.total_rounds_completed} · {selectedAlgorithm}</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "12px 0" }}>
                  <button className="run-button" onClick={() => { if (safeRoundIndex >= history.length - 1) setRoundIndex(0); setIsPlaying(true); }} disabled={isPlaying}>Play</button>
                  <button className="algorithm-button" onClick={() => setIsPlaying(false)} disabled={!isPlaying}>Pause</button>
                  <button className="algorithm-button" onClick={() => { setIsPlaying(false); setRoundIndex((i) => Math.max(0, i - 1)); }}>Previous</button>
                  <button className="algorithm-button" onClick={() => { setIsPlaying(false); setRoundIndex((i) => Math.min(history.length - 1, i + 1)); }}>Next</button>
                  <button className="algorithm-button" onClick={() => { setIsPlaying(false); setRoundIndex(0); }}>Restart</button>
                </div>
                <input aria-label="Simulation round" type="range" min="0" max={Math.max(history.length - 1, 0)} value={safeRoundIndex} onChange={(event) => { setIsPlaying(false); setRoundIndex(Number(event.target.value)); }} style={{ width: "100%" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", opacity: 0.75 }}><span>Round 1</span><span>Round {history.length}</span></div>
              </section>
            )}

            {/* SELECTED ALGORITHM RESULTS */}
            {currentRound && selectedResult && (
              <SimulationResults
                result={selectedResult}
                round={currentRound}
                algorithm={selectedAlgorithm}
              />
            )}

            {/* NETWORK AND CONFIGURATION */}
            <section className="dashboard-grid">
              <div className="panel topology-panel">
                <NetworkTopology simulationSnapshot={currentRound} />
              </div>

              <div className="panel">
                <h2>Network Configuration</h2>

                <Config
                  label="Network Area"
                  value={
                    network
                      ? `${network.area_width} × ${network.area_height} m`
                      : "Loading..."
                  }
                />

                <Config
                  label="Base Station"
                  value={
                    network
                      ? `(${network.base_station.x}, ${network.base_station.y})`
                      : "Loading..."
                  }
                />

                <Config
                  label="Communication Range"
                  value={
                    communication
                      ? communication.communication_range_m == null
                        ? `Candidates: ${communication.candidate_ranges_m.join(", ")} m`
                        : `${communication.communication_range_m} m`
                      : "Loading..."
                  }
                />

                <Config
                  label="Packet Size"
                  value={
                    simulation
                      ? `${simulation.packet_size_bits} bits`
                      : "Loading..."
                  }
                />

                <Config
                  label="GA Population"
                  value={ga?.population_size ?? "Loading..."}
                />

                <Config
                  label="GA Generations"
                  value={ga?.generations ?? "Loading..."}
                />
              </div>
            </section>

            {/* ALGORITHM SELECTION */}
            <section className="panel algorithm-panel">
              <h2>Routing Algorithms</h2>

              <div className="algorithm-grid">
                {algorithms.map((algorithm) => (
                  <button
                    key={algorithm}
                    className={`algorithm-button ${
                      selectedAlgorithm === algorithm ? "selected" : ""
                    }`}
                    onClick={() => handleAlgorithmChange(algorithm)}
                  >
                    {algorithm}
                  </button>
                ))}
              </div>

              <p>
                Selected algorithm: <strong>{selectedAlgorithm}</strong>
              </p>

              <small>
                ANN is used for cluster-head selection. All six algorithms
                perform multi-hop routing.
              </small>
            </section>
          </>
        )}

        {/* NETWORK PAGE */}
        {activePage === "Network" && (
          <section className="panel">
            <NetworkTopology simulationSnapshot={currentRound} />
          </section>
        )}

        {/* ROUTING PAGE */}
        {activePage === "Routing" && (
          <section className="panel">
            <h2>Routing Algorithms</h2>

            <p>
              Selected algorithm: <strong>{selectedAlgorithm}</strong>
            </p>

            <div className="algorithm-grid">
              {algorithms.map((algorithm) => (
                <button
                  key={algorithm}
                  className={`algorithm-button ${
                    selectedAlgorithm === algorithm ? "selected" : ""
                  }`}
                  onClick={() => handleAlgorithmChange(algorithm)}
                >
                  {algorithm}
                </button>
              ))}
            </div>

            <button
              className="run-button"
              onClick={handleRun}
              disabled={isRunning}
            >
              {isRunning ? "Running..." : "Run All Algorithms"}
            </button>

            {message && <p style={{ marginTop: "15px" }}>{message}</p>}

            {currentRound && selectedResult && (
              <SimulationResults
                result={selectedResult}
                round={currentRound}
                algorithm={selectedAlgorithm}
              />
            )}
          </section>
        )}

        {/* RESULTS PAGE */}
        {activePage === "Results" && (
          <section className="panel">
            <h2>Simulation Results</h2>

            {simulationResult ? (
              <>
                <AlgorithmComparison
                  comparison={simulationResult.comparison}
                  selectedAlgorithm={selectedAlgorithm}
                  onSelect={handleAlgorithmChange}
                />

                {currentRound && selectedResult && (
                  <SimulationResults
                    result={selectedResult}
                    round={currentRound}
                    algorithm={selectedAlgorithm}
                  />
                )}
              </>
            ) : (
              <p>
                No simulation results available. Run all algorithms
                from the Dashboard first.
              </p>
            )}
          </section>
        )}

        {/* SETTINGS PAGE */}
        {activePage === "Settings" && (
          <section className="panel">
            <h2>Simulation Settings</h2>

            <p>Values loaded from simulation_config.json.</p>

            <Config
              label="Random Seed"
              value={network?.random_seed ?? "—"}
            />

            <Config
              label="Deployment"
              value={network?.deployment ?? "—"}
            />

            <Config
              label="Number of Rounds"
              value={simulation?.num_rounds ?? "—"}
            />

            <Config
              label="Number of Cluster Heads"
              value={simulation?.num_cluster_heads ?? "—"}
            />
          </section>
        )}

        <footer>
          WSN Routing Optimization Project · React + FastAPI
        </footer>
      </main>
    </div>
  );
}

// SIX-ALGORITHM COMPARISON
function AlgorithmComparison({
  comparison,
  selectedAlgorithm,
  onSelect,
}) {
  return (
    <section className="panel" style={{ marginBottom: "22px" }}>
      <h2>Six-Algorithm Performance Comparison</h2>

      <p>
        Cluster-head selection: <strong>ANN</strong>
      </p>

      <div style={{ overflowX: "auto", marginTop: "15px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "750px",
          }}
        >
          <thead>
            <tr>
              {[
                "Algorithm",
                "Alive Nodes",
                "Dead Nodes",
                "Residual Energy (J)",
                "Energy Consumed (J)",
                "Routing Distance (m)",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    textAlign: "left",
                    padding: "12px",
                    borderBottom: "1px solid #334155",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {comparison.map((item) => (
              <tr
                key={item.algorithm}
                onClick={() => onSelect(item.algorithm)}
                style={{
                  cursor: "pointer",
                  background:
                    selectedAlgorithm === item.algorithm
                      ? "rgba(155,122,255,0.12)"
                      : "transparent",
                }}
              >
                <td style={{ padding: "12px" }}>
                  <strong>{item.algorithm}</strong>
                </td>
                <td style={{ padding: "12px" }}>
                  {item.final_alive_nodes}
                </td>
                <td style={{ padding: "12px" }}>
                  {item.final_dead_nodes}
                </td>
                <td style={{ padding: "12px" }}>
                  {formatNumber(item.final_residual_energy)}
                </td>
                <td style={{ padding: "12px" }}>
                  {formatNumber(item.total_energy_consumed)}
                </td>
                <td style={{ padding: "12px" }}>
                  {formatNumber(item.final_routing_distance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <small>
        Select an algorithm row to inspect its individual network history.
      </small>
    </section>
  );
}

// INDIVIDUAL SIMULATION RESULTS
function SimulationResults({ result, round, algorithm }) {
  const metrics = round.metrics || {};

  return (
    <section className="panel" style={{ marginBottom: "22px" }}>
      <h2>
        {algorithm} Results — Round {round.round}
      </h2>

      <p>
        Routing algorithm: <strong>{algorithm}</strong>
      </p>

      <p>
        Cluster-head algorithm: <strong>ANN</strong>
      </p>

      <p>
        Completed rounds:{" "}
        <strong>{result.total_rounds_completed}</strong>
      </p>

      <p>
        Communication range:{" "}
        <strong>{result.communication_range} m</strong>
      </p>

      <h3 style={{ marginTop: "24px" }}>
        Selected Cluster Heads
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "12px",
        }}
      >
        {(round.selected_ch_ids || []).map((id) => (
          <span
            key={id}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(243,182,78,0.15)",
              color: "#f3b64e",
              fontWeight: "600",
            }}
          >
            CH {id}
          </span>
        ))}
      </div>

      <h3 style={{ marginTop: "25px" }}>Network Metrics</h3>

      <div className="metrics-grid">
        {Object.entries(metrics).map(([key, value]) => (
          <Metric
            key={key}
            title={key.replaceAll("_", " ")}
            value={
              typeof value === "number"
                ? formatNumber(value)
                : String(value)
            }
            detail="Round result"
          />
        ))}
      </div>

      <h3 style={{ marginTop: "25px" }}>Cluster Membership</h3>

      {Object.entries(round.clusters || {}).map(([chId, members]) => (
        <div
          key={chId}
          style={{
            padding: "12px",
            marginTop: "8px",
            borderRadius: "8px",
            background: "rgba(100,130,170,0.10)",
          }}
        >
          <strong>CH {chId}</strong>

          <p style={{ marginTop: "6px", lineHeight: "1.7" }}>
            Members: {members.join(", ")}
          </p>
        </div>
      ))}

      <h3 style={{ marginTop: "25px" }}>
        Multi-Hop Routing Paths
      </h3>

      {Object.entries(round.routes || {}).map(([chId, route]) => (
        <div
          key={chId}
          style={{
            padding: "12px",
            marginTop: "8px",
            borderRadius: "8px",
            background: "rgba(155,122,255,0.10)",
          }}
        >
          <strong>CH {chId}</strong>

          <p style={{ marginTop: "6px", color: "#bba7ff" }}>
            {route.join(" → ")}
          </p>
        </div>
      ))}

      <h3 style={{ marginTop: "25px" }}>Multi-Hop Forwarding</h3>

      {(round.forwarding || []).map((item, index) => (
        <div
          key={`${item.cluster_head}-${index}`}
          style={{
            padding: "10px",
            marginTop: "7px",
            background: "rgba(34,197,94,0.08)",
            borderRadius: "8px",
          }}
        >
          CH {item.cluster_head} →{" "}
          {item.next_hop === "BS"
            ? "Base Station"
            : `CH ${item.next_hop}`}{" "}
          ({Number(item.distance).toFixed(2)} m)
        </div>
      ))}

      <h3 style={{ marginTop: "25px" }}>Node Status</h3>

      <p>
        Alive nodes: <strong>{metrics.alive_nodes ?? "—"}</strong>
      </p>

      <p>
        Dead nodes: <strong>{metrics.dead_nodes ?? "—"}</strong>
      </p>

      <p>
        Total residual energy:{" "}
        <strong>
          {Number(metrics.total_residual_energy ?? 0).toFixed(4)} J
        </strong>
      </p>
    </section>
  );
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(4))
    : value ?? "—";
}

function Metric({ title, value, detail }) {
  return (
    <div className="metric-card">
      <p>{title}</p>
      <h2>{value}</h2>
      <small>{detail}</small>
    </div>
  );
}

function Config({ label, value }) {
  return (
    <div className="config-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
