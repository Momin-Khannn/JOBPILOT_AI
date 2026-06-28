import pg from 'pg'

const { Pool } = pg

function sslConfig() {
  if (process.env.PGSSL === 'true') return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
  return undefined
}

export function createPostgresStore({ emptyStore, normalizeStore }) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Math.max(2, Number(process.env.PG_POOL_MAX || 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslConfig(),
  })
  let initialization = null

  async function ensure(initialStore) {
    if (!initialization) {
      initialization = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS jobpilot_state (
            id SMALLINT PRIMARY KEY CHECK (id = 1),
            version BIGINT NOT NULL DEFAULT 1,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `)
        await pool.query(
          `INSERT INTO jobpilot_state (id, data)
           VALUES (1, $1::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [JSON.stringify(normalizeStore(initialStore || emptyStore()))]
        )
      })().catch((error) => {
        initialization = null
        throw error
      })
    }
    return initialization
  }

  async function read() {
    await ensure()
    const { rows } = await pool.query('SELECT data FROM jobpilot_state WHERE id = 1')
    return normalizeStore(rows[0]?.data || emptyStore())
  }

  async function write(store) {
    await ensure()
    await pool.query(
      `UPDATE jobpilot_state
       SET data = $1::jsonb, version = version + 1, updated_at = NOW()
       WHERE id = 1`,
      [JSON.stringify(normalizeStore(store))]
    )
  }

  async function update(mutator, isStoreSnapshot) {
    await ensure()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query('SELECT data FROM jobpilot_state WHERE id = 1 FOR UPDATE')
      const store = normalizeStore(rows[0]?.data || emptyStore())
      const result = await mutator(store)
      const nextStore = isStoreSnapshot(result) ? result : store
      await client.query(
        `UPDATE jobpilot_state
         SET data = $1::jsonb, version = version + 1, updated_at = NOW()
         WHERE id = 1`,
        [JSON.stringify(normalizeStore(nextStore))]
      )
      await client.query('COMMIT')
      return result === undefined ? store : result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  return { ensure, read, write, update }
}
