import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailAgentModule } from './gmail/email-agent.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';


@Module({
  imports: [
    HealthModule,
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    EmailAgentModule,

  ],
})
export class AppModule {}