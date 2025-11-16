import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailAgentController } from './controller/email-agent.controller';
import { EmailAnalysisService } from './email-analysis/email-analysis';
import { EmailAgentService } from './service/email-agent.service';
import { GmailService } from './service/gmail.service';
import { GmailOAuthController } from './oauth.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAgentController, GmailOAuthController],
  providers: [EmailAgentService, GmailService, EmailAnalysisService],
  exports: [EmailAgentService],
})
export class EmailAgentModule {}
