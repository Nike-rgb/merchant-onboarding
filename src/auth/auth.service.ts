import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { verifyPassword } from '../common/security/password.util';
import { JwtPayload } from './types/auth-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(email);
    // Verify a hash even when the user is missing to reduce timing/enumeration
    // signal, and return a single generic error either way.
    const hash =
      user?.passwordHash ??
      '$2a$10$0000000000000000000000000000000000000000000000000000';
    const ok = await verifyPassword(password, hash);
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
