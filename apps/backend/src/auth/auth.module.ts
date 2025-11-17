import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '../config/config.module';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    forwardRef(() => OrganizationsModule),
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: ['JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL'],
      useFactory: (secret: string, ttlSeconds: number) => ({
        secret,
        signOptions: { expiresIn: ttlSeconds },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAccessStrategy],
  exports: [AuthService],
})
export class AuthModule {}
