import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER || 'stores_user',
  password: process.env.DB_PASSWORD || 'stores_pass',
  database: process.env.DB_NAME || 'stores_db',
  max:      20,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> => pool.query<T>(text, params);

export const getClient = () => pool.connect();
