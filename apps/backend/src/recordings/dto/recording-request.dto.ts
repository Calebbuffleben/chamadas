import { IsNotEmpty, IsString } from 'class-validator';

export class RecordingRequestDto {
  @IsString()
  @IsNotEmpty()
  roomName!: string;
}


