import { IsUUID } from 'class-validator';

export class SwitchOrganizationDto {
  @IsUUID()
  membershipId!: string;
}


