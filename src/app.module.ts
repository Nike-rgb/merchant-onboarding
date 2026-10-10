import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { dataSourceOptions } from './data-source';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ApplicationsModule } from './applications/applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<AppConfig, true>,
      ): TypeOrmModuleOptions => {
        const db = config.getOrThrow('database', { infer: true });
        return {
          ...dataSourceOptions,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.name,
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const redis = config.getOrThrow('redis', { infer: true });
        return { connection: { host: redis.host, port: redis.port } };
      },
    }),
    AuthModule,
    ApplicationsModule,
  ],
  providers: [
    // Order matters: authenticate (JWT) before authorizing (roles).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
