export type SqlParameter = string | number | boolean | null;
export interface SqlExecutor {
  exec(statement: string): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(statement: string, parameters?: readonly SqlParameter[]): Promise<{ rows: T[] }>;
}
export interface SqlDatabase extends SqlExecutor {
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
