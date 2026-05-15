import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppAuthController } from '@/app/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { UserEntity } from '@/auth/entities/user.entity';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { getJwtConfig } from '@/config/jwt.config';
import { RedisModule } from '@/system/redis.module';
// import { WebAuthController } from '@/web/auth.controller';
import { WebUserController } from '@/web/user.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    RedisModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = getJwtConfig(configService);

        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.ttlSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AppAuthController, WebUserController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
