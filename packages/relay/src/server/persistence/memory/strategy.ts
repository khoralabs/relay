import { createInMemoryRateLimiter } from "../../rate-limit";
import type { RelayPersistenceStrategy } from "../core/types";
import { createInMemoryNonceStore } from "./nonce-store";

export function createMemoryPersistenceStrategy(): RelayPersistenceStrategy {
  return {
    kind: "memory",
    createNonceStore: () => createInMemoryNonceStore(),
    createRateLimiter: (rule) => createInMemoryRateLimiter(rule),
  };
}
