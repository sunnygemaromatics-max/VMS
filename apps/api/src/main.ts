import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  // Fail fast: never boot prod with a missing/weak JWT secret.
  if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be set to a strong value (>=32 chars) in production');
  }

  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Global pipes
  app.useGlobalPipes(new ValidationPipe());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
  // Audit interceptor is registered globally via APP_INTERCEPTOR in AppModule
  // so it can receive DI (PrismaService).

  // CORS — supports comma-separated list of origins via CORS_ORIGIN env
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // Swagger / OpenAPI docs at /docs — disabled in production to avoid
  // exposing the full API surface publicly.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VMS API')
      .setDescription('Enterprise visitor & workforce management API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDoc, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`✓ API running on port ${port}${isProd ? '' : ' (docs: /docs)'}`);
}

bootstrap();
