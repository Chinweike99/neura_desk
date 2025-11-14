import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 4000);
  console.log(`Server running on port ${process.env.PORT ?? 4000}`);
}

// Use void to explicitly mark the promise as intentionally not awaited
void bootstrap();
