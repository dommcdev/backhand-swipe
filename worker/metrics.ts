/** Request-local D1 accounting. Only enabled by the development entry point. */
export function measureD1(db: D1Database) {
  const totals = { rowsRead: 0, rowsWritten: 0, queries: 0 }
  const originals = new WeakMap<D1PreparedStatement, D1PreparedStatement>()
  function record<T extends D1Result>(result: T): T {
    totals.rowsRead += result.meta.rows_read
    totals.rowsWritten += result.meta.rows_written
    totals.queries++
    return result
  }
  function statement(original: D1PreparedStatement): D1PreparedStatement {
    const wrapped = new Proxy(original, {
      get(target, key) {
        if (key === 'bind') return (...values: unknown[]) => statement(target.bind(...values))
        if (key === 'run' || key === 'all') return async () => record(await target.all())
        // first() discards metadata; use the identical query through all() instead.
        if (key === 'first') return async (column?: string) => {
          const result = record(await target.all<Record<string, unknown>>())
          const row = result.results[0]
          if (column !== undefined && row && !(column in row)) throw new Error(`Missing column: ${column}`)
          return column === undefined ? row ?? null : row?.[column] ?? null
        }
        const value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    originals.set(wrapped, original)
    return wrapped
  }
  const measured = new Proxy(db, {
    get(target, key) {
      if (key === 'prepare') return (sql: string) => statement(target.prepare(sql))
      if (key === 'batch') return async (statements: D1PreparedStatement[]) =>
        (await target.batch(statements.map((s) => originals.get(s) ?? s))).map(record)
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { db: measured, totals }
}
