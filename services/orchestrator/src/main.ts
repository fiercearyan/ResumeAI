import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { origin: true, credentials: true },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('ResumeAI Orchestrator')
    .setDescription('REST + WebSocket API for ResumeAI')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc);

  const port = parseInt(process.env.ORCHESTRATOR_PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[orchestrator] listening on :${port}`);
}
bootstrap();
