import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RequestMeetingTokenDto {
  @IsOptional()
  @IsString()
  participantName?: string;

  @IsOptional()
  @IsString()
  identity?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
