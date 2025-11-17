import { IsEmail, IsEnum, IsOptional, IsPositive } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptional()
  @IsPositive()
  expiresInHours?: number;
}
