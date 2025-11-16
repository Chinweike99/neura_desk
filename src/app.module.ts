import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailAgentModule } from './gmail/email-agent.module';
import { AuthModule } from './auth/auth.module';
// import { AuthModule } from './auth/auth.module';
// import { EmailAgentModule } from './email-agent/email-agent.module';
// import { SocialMediaModule } from './social-media/social-media.module';
// import { JobHunterModule } from './job-hunter/job-hunter.module';
// import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    EmailAgentModule,
    // SocialMediaModule,
    // JobHunterModule,
    // DashboardModule,
  ],
})
export class AppModule {}