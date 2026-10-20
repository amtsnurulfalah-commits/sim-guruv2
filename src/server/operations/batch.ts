import "server-only";
/** One runtime connection: finish a claim/delivery before starting the next. */
export async function deliverBatch<T extends { processed: number }>(
  worker: { deliverOne(): Promise<T> },
  limit: number,
  deadline: number,
  clock = Date.now,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < limit && clock() < deadline; i++) {
    const result = await worker.deliverOne();
    results.push(result);
    if (result.processed === 0) break;
  }
  return results;
}
