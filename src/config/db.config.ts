import type { ConfigService } from '@nestjs/config';

export interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export function getDbConfig(configService: ConfigService): DbConfig {
  const config = configService.get<DbConfig>('mysql');

  if (!config) {
    throw new Error('MySQL config is missing');
  }

  return {
    host: config.host,
    port: Number(config.port),
    username: config.username,
    password: config.password,
    database: config.database,
    synchronize: Boolean(config.synchronize),
    logging: Boolean(config.logging),
  };
}
