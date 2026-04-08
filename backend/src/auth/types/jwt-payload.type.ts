import type { UserRole } from '../../users/user-role';

export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  role: UserRole;
}
