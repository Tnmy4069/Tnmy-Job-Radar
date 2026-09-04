import { AI_CIRCUIT_COOLDOWN_MS, AI_CIRCUIT_FAILURE_THRESHOLD } from "./config";
import { setAiCircuitState } from "./metrics";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

let state: CircuitState = "CLOSED";
let failures = 0;
let openedAt = 0;

export function getCircuitState(): CircuitState {
  if (state === "OPEN" && Date.now() - openedAt >= AI_CIRCUIT_COOLDOWN_MS) {
    state = "HALF_OPEN";
    setAiCircuitState(state);
  }
  return state;
}

export function canDispatchAiRequest(): boolean {
  const current = getCircuitState();
  return current !== "OPEN";
}

export function recordCircuitSuccess() {
  failures = 0;
  state = "CLOSED";
  setAiCircuitState(state);
}

export function recordCircuitFailure() {
  if (state === "HALF_OPEN") {
    trip();
    return;
  }
  failures += 1;
  if (failures >= AI_CIRCUIT_FAILURE_THRESHOLD) trip();
}

function trip() {
  state = "OPEN";
  openedAt = Date.now();
  setAiCircuitState(state);
}

export function resetCircuitForTests() {
  state = "CLOSED";
  failures = 0;
  openedAt = 0;
  setAiCircuitState("CLOSED");
}
