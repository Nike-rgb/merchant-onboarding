import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env when this file is executed standalone by the TypeORM CLI
// (migration:generate / migration:run). Inside the app, @nestjs/config
// owns env loading; inside docker-compose, env is injected directly.
dotenv.config();

export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'merchant',
  password: process.env.DB_PASSWORD ?? 'merchant_pw',
  database: process.env.DB_NAME ?? 'merchant_onboarding',
  // Resolve to .ts under ts-node (dev) and .js under dist (prod/docker).
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/database/migrations/*.{ts,js}'],
  // Migrations are the source of truth. Never auto-sync schema.
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
} satisfies DataSourceOptions;

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
