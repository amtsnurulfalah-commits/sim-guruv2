/** Explicit JSON payload: adapters must send this text once, never JSON-encode it again. */
export class SqlJsonParameter {
  readonly text: string;
  constructor(value: unknown) {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("INVALID_SQL_JSON_PARAMETER");
    this.text = encoded;
  }
}
export const sqlJson = (value: unknown) => new SqlJsonParameter(value);
export type SqlParameter = string | number | boolean | null | SqlJsonParameter;
export interface SqlExecutor {
  exec(statement: string): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters?: readonly SqlParameter[],
  ): Promise<{ rows: T[] }>;
}
export interface SqlDatabase extends SqlExecutor {
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
