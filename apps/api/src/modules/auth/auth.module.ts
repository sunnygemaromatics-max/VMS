import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      // Prod boot fails fast (main.ts) if JWT_SECRET is unset; this dev-only
      // fallback never applies in production.
      secret:
        process.env.JWT_SECRET ||
        (process.env.NODE_ENV === 'production' ? '' : 'dev_only_insecure_secret'),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
