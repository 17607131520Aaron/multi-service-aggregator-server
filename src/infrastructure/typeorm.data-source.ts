import { load } from 'js-yaml';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { UserEntity } from '@/auth/entities/user.entity';

interface AppConfig {
  mysql?: {
    host?: string;
    port?: number | string;
    username?: string;
    password?: string;
    database?: string;
    logging?: boolean;
  };
}

function resolveConfigFilePath(): string {
  const runtimeEnv = process.env.NODE_ENV ?? 'development';
  const configFilePath = join(process.cwd(), 'config', `application.${runtimeEnv}.yml`);

  if (existsSync(configFilePath)) {
    return configFilePath;
  }

  return join(process.cwd(), 'config', 'application.test.yml');
}

function loadAppConfig(): AppConfig {
  const configFilePath = resolveConfigFilePath();
  const fileContent = readFileSync(configFilePath, 'utf8');

  return (load(fileContent) as AppConfig) ?? {};
}

const appConfig = loadAppConfig();

if (!appConfig.mysql) {
  throw new Error('MySQL config is missing for TypeORM data source');
}

export default new DataSource({
  type: 'mysql',
  host: appConfig.mysql.host,
  port: Number(appConfig.mysql.port),
  username: appConfig.mysql.username,
  password: appConfig.mysql.password,
  database: appConfig.mysql.database,
  logging: Boolean(appConfig.mysql.logging),
  entities: [UserEntity],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'schema_migrations',
});
