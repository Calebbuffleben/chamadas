import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [PrismaModule, HttpModule, ConfigModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
