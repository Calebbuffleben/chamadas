import { IsOptional, IsString } from 'class-validator';

export class RequestMeetingTokenDto {
  @IsOptional()
  @IsString()
  participantName?: string;

  @IsOptional()
  @IsString()
  identity?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
