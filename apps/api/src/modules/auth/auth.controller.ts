import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string; totp?: string }) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException('email and password are required');
    }
    return this.authService.loginWithOptionalTotp(body.email, body.password, body.totp);
  }

  @Post('register')
  async register(
    @Body() body: { email: string; password: string; fullName: string; branchId: string },
  ) {
    if (!body?.email || !body?.password || !body?.fullName || !body?.branchId) {
      throw new BadRequestException(
        'email, password, fullName and branchId are required',
      );
    }
    if (body.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    try {
      return await this.authService.register(
        body.email,
        body.password,
        body.fullName,
        body.branchId,
      );
    } catch (e: any) {
      // Prisma unique constraint
      if (e?.code === 'P2002') {
        throw new BadRequestException('Email already registered');
      }
      throw e;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    const me = await this.authService.me(user.userId);
    if (!me) throw new UnauthorizedException('User no longer exists');
    return me;
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body?.currentPassword || !body?.newPassword) {
      throw new BadRequestException('currentPassword and newPassword are required');
    }
    if (body.newPassword.length < 6) {
      throw new BadRequestException('newPassword must be at least 6 characters');
    }
    try {
      return await this.authService.changePassword(
        user.userId,
        body.currentPassword,
        body.newPassword,
      );
    } catch (e: any) {
      if (e?.message === 'Current password is incorrect') {
        throw new UnauthorizedException(e.message);
      }
      throw new BadRequestException(e?.message ?? 'Could not change password');
    }
  }

  // --- 2FA ----------------------------------------------------------------
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setup2fa(@CurrentUser() user: any) {
    return this.authService.totpSetup(user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  enable2fa(@CurrentUser() user: any, @Body() body: { totp: string }) {
    if (!body?.totp) throw new BadRequestException('totp is required');
    return this.authService.totpEnable(user.userId, body.totp);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  disable2fa(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; totp: string },
  ) {
    if (!body?.currentPassword || !body?.totp) {
      throw new BadRequestException('currentPassword and totp are required');
    }
    return this.authService.totpDisable(user.userId, body.currentPassword, body.totp);
  }

  // --- Password reset -----------------------------------------------------
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body() body: { email: string }) {
    if (!body?.email) throw new BadRequestException('email required');
    return this.authService.createResetToken(body.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() body: { token: string; newPassword: string }) {
    if (!body?.token || !body?.newPassword) {
      throw new BadRequestException('token and newPassword required');
    }
    return this.authService.resetPasswordWithToken(body.token, body.newPassword);
  }
}
