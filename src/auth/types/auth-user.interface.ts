import { UserRole } from '../../users/enums/user-role.enum';

/** Shape attached to `request.user` after JWT authentication. */
export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

/** JWT payload we sign and verify. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
