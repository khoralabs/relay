import { describePersistenceStrategyContract } from "../core/strategy.contract";
import { createMemoryPersistenceStrategy } from "./strategy";

describePersistenceStrategyContract("memory", () => ({
  strategy: createMemoryPersistenceStrategy(),
  cleanup() {},
}));
