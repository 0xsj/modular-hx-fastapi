import { NestFactory } from '@nestjs/core';
import { AppModule } from './root/app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
