import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TeamsService {
  constructor(private readonly httpService: HttpService) {}

  async getTeamsData() {
    const response = await firstValueFrom(this.httpService.get('https://api.example.com/teams'));
    return response.data;
  }
}
