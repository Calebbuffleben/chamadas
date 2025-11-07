import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupAudioEgressWsServer, setupVideoEgressWsServer } from './egress/media-egress.server';
import { PrismaService } from './prisma/prisma.service';
import { AudioPipelineService } from './pipeline/audio-pipeline.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Parse LiveKit webhooks (application/webhook+json) sem depender de express/body-parser
  app.use((req: any, _res: any, next: () => void) => {
    const ct = (req.headers['content-type'] as string) || '';
    if (ct.includes('application/webhook+json')) {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => (data += chunk));
      req.on('end', () => {
        try {
          req.body = data ? JSON.parse(data) : {};
        } catch {
          req.body = {};
        }
        next();
      });
      return;
    }
    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prepare WS receiver for LiveKit audio egress (PCM → WAV)
  const httpServer = app.getHttpServer();
  const prisma = app.get(PrismaService);
  const audioPipeline = app.get(AudioPipelineService);
  setupAudioEgressWsServer(httpServer, {
    path: '/egress-audio',
    outputDir: process.env.EGRESS_AUDIO_OUTPUT_DIR,
  }, prisma, audioPipeline);
  setupVideoEgressWsServer(httpServer, {
    path: '/egress-video',
    outputDir: process.env.EGRESS_VIDEO_OUTPUT_DIR,
  }, prisma);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();

