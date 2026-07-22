import { describePersistenceStrategyContract } from "../core/strategy.contract";
import { DEV_SQLCIPHER_KEY, openRelayDatabase } from "./db";
import { createSqlitePersistenceStrategy } from "./strategy";

describePersistenceStrategyContract("sqlite", () => {
  const db = openRelayDatabase(":memory:", DEV_SQLCIPHER_KEY);
  return {
    strategy: createSqlitePersistenceStrategy(db),
    cleanup() {
      db.close();
    },
  };
});
