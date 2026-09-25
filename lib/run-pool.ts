export const UPLOAD_CONCURRENCY = 3

// Runs several jobs at once. One rejection does not cancel the others;
// the worker should catch its own errors.
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  if (items.length === 0) {
    return
  }
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        if (index >= items.length) {
          return
        }
        await worker(items[index])
      }
    },
  )
  await Promise.all(workers)
}
