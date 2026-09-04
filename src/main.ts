import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir consumo desde frontends y herramientas externas
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,OPTIONS',
  });

  // Middleware para dar soporte transparente tanto a rutas con /api/v1 como a rutas directas
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/academic') && !req.url.startsWith('/api/v1/academic')) {
      req.url = `/api/v1${req.url}`;
    } else if (req.url === '/health') {
      req.url = '/api/v1/health';
    }
    next();
  });

  // Prefijo global de versión de API
  app.setGlobalPrefix('api/v1', {
    exclude: ['docs'],
  });

  // Validación y transformación global de tipos
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
      stopAtFirstError: true,
    })
  );

  // Configuración de Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('GastroForge Academic API')
    .setDescription(
      'API pública y determinista de análisis de complejidad algorítmica y estructuras de datos inspirada en el dominio de restaurantes Gastroforge.'
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Verificación de estado y disponibilidad')
    .addTag('Academic-Analysis', 'Algoritmos y pruebas de complejidad computacional')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const swaggerCustomOptions = {
    swaggerOptions: {
      deepLinking: true,
    },
  };
  SwaggerModule.setup('api/v1/docs', app, document, swaggerCustomOptions);
  SwaggerModule.setup('docs', app, document, swaggerCustomOptions);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 GastroForge Academic API ejecutándose en el puerto ${port}`);
  console.log(`📚 Documentación Swagger disponible en: http://localhost:${port}/api/v1/docs y /docs`);
}

bootstrap();
