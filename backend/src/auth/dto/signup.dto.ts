import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ example: 'user@example.com', format: 'email' })
  email!: string;

  @ApiProperty({ example: 'your-password', format: 'password', minLength: 6 })
  password!: string;

  @ApiProperty({ example: '홍길동' })
  name!: string;
}
