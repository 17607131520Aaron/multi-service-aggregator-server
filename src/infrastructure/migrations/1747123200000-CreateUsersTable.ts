import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

export class CreateUsersTable1747123200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsersTable = await queryRunner.hasTable('users');
    if (hasUsersTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            unsigned: true,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'password_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'registration_source',
            type: 'enum',
            enum: ['app', 'web'],
          },
          {
            name: 'enabled',
            type: 'tinyint',
            width: 1,
            default: '1',
          },
          {
            name: 'last_login_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new TableIndex({
            name: 'uk_users_username',
            columnNames: ['username'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'uk_users_email',
            columnNames: ['email'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'uk_users_phone',
            columnNames: ['phone'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'idx_users_registration_source',
            columnNames: ['registration_source'],
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasUsersTable = await queryRunner.hasTable('users');
    if (!hasUsersTable) {
      return;
    }

    await queryRunner.dropTable('users');
  }
}
