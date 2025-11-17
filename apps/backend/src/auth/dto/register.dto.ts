import { IsEmail, IsNotEmpty, IsOptional, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsNotEmpty()
  organizationName!: string;

  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'organizationSlug must contain only lowercase letters, numbers or hyphen',
  })
  organizationSlug!: string;
}
