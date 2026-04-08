import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../user-role';

/** 관리자 전용: 다른 계정의 역할을 DB에 반영 */
export class AdminSetRoleDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}
