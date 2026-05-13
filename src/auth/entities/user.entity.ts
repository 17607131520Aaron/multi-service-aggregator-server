import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRegistrationSource {
  APP = 'app',
  WEB = 'web',
}

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  public id: string;

  @Index('uk_users_username', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  public username: string | null;

  @Index('uk_users_email', { unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  public email: string | null;

  @Index('uk_users_phone', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  public phone: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  public passwordHash: string | null;

  @Column({
    name: 'registration_source',
    type: 'enum',
    enum: UserRegistrationSource,
  })
  public registrationSource: UserRegistrationSource;

  @Column({ type: 'boolean', default: true })
  public enabled: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  public lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  public updatedAt: Date;
}
