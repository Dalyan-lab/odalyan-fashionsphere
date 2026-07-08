import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthUser,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) input: RegisterInput) {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput) {
    return this.authService.login(input);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) input: ForgotPasswordInput) {
    return this.authService.forgotPassword(input.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) input: ResetPasswordInput) {
    return this.authService.resetPassword(input.token, input.password);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('become-seller')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  becomeSeller(@CurrentUser('id') userId: string) {
    return this.authService.becomeSeller(userId);
  }
}
