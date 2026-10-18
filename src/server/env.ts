import "server-only";
import { parseEnvironment, type EnvironmentScope, type ScopeEnvironment } from "@/lib/env/schema";

export class EnvironmentConfigurationError extends Error {
  readonly code = "CONFIGURATION_MISSING";
  constructor(readonly scope: EnvironmentScope, readonly fields: readonly string[]) {
    super(`Konfigurasi ${scope} belum valid: ${fields.join(", ")}.`);
    this.name = "EnvironmentConfigurationError";
  }
}

export function requireEnvironment<S extends EnvironmentScope>(scope: S): ScopeEnvironment<S> {
  const result = parseEnvironment(scope, process.env);
  if (!result.ok) throw new EnvironmentConfigurationError(scope, result.issues.map(({ field }) => field));
  return result.value;
}
