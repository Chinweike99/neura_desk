import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailAnalysisService } from '../email-analysis/email-analysis';
import { GmailService } from './gmail.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateEmailDigestDto } from 'src/dtos/email.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmailAgentService {
  private readonly logger = new Logger(EmailAgentService.name);

  constructor(
    private prisma: PrismaService,
    private gmailService: GmailService,
    private emailAnalysis: EmailAnalysisService,
  ) {}

  async connectGmail(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiryDate: Date,
  ) {
    // Store or update Gmail connection
    await this.prisma.gmailConnection.upsert({
      where: { userId },
      update: {
        accessToken,
        refreshToken,
        expiryDate,
      },
      create: {
        userId,
        accessToken,
        refreshToken,
        expiryDate,
        connected: true,
      },
    });

    // Test the connection
    this.gmailService.setCredentials(accessToken, refreshToken);
    const isConnected = await this.gmailService.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Gmail with provided tokens.');
    }
    return {
      success: true,
      message: 'Gmail account connected successfully.',
    };
  }

  async getGmailStatus(userId: string) {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.connected) {
      return {
        connected: false,
        message: 'No Gmail account connected.',
      };
    }

    // Test if connection is still valid
    this.gmailService.setCredentials(
      connection.accessToken,
      connection.refreshToken,
    );
    const isActive = await this.gmailService.testConnection();

    if (!isActive) {
      // Update status in DB
      await this.prisma.gmailConnection.update({
        where: { userId },
        data: { connected: false },
      });
    }
    return {
      connected: isActive,
      lastConnected: connection.updatedAt,
      message: isActive
        ? 'Gmail account is connected and active.'
        : 'Gmail account connection is inactive.',
    };
  }

  async runEmailDigest(userId: string): Promise<CreateEmailDigestDto> {
    this.logger.log(`Running email digest for user: ${userId}`);
    // Get Gmail connection
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { userId, connected: true },
    });

    if (!connection) {
      throw new NotFoundException('Gmail connection not found or inactive');
    }
    // Set up Gmail service with users tokens
    this.gmailService.setCredentials(
      connection.accessToken,
      connection.refreshToken,
    );

    // Get last digest to determine emails since last check
    const lastDigest = await this.prisma.emailDigest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const lastChecked =
      lastDigest?.createdAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago

    // Fetch unread emails
    const unreadEmails = await this.gmailService.getUnreadEmails(lastChecked);
    this.logger.log(`Found ${unreadEmails.length} unread emails`);

    if (unreadEmails.length === 0) {
      // Create empty digest
      const digest = await this.prisma.emailDigest.create({
        data: {
          userId,
          totalEmails: 0,
          summaryText: 'No new Emails to process',
        },
      });

      return {
        id: digest.id,
        totalEmails: 0,
        summaryText: digest.summaryText,
        createdAt: digest.createdAt,
        summaries: [],
      };
    }

    // Process each email with AI analysis
    const emailSummaries: Prisma.EmailSummaryCreateInput[] = [];
    const processedEmailIds: string[] = [];

    for (const email of unreadEmails) {
      try {
        const analysis = await this.emailAnalysis.analyzeEmail({
          subject: email.subject,
          body: email.body.substring(0, 10000), // Limit body length for AI processing
          sender: email.sender.name || email.sender.email,
        });

        emailSummaries.push({
          emailId: email.id,
          senderEmail: email.sender.email,
          senderName: email.sender.name,
          subject: email.subject,
          summary: analysis.summary,
          category: analysis.category,
          priority: analysis.priority,
          actionRequired: analysis.actionRequired,
          sentiment: analysis.sentiment,
          digest: {
            create: undefined,
            connectOrCreate: undefined,
            connect: undefined,
          },
        });

        processedEmailIds.push(email.id);
      } catch (error) {
        this.logger.error(`Failed to analyze email ${email.id}:`, error);
      }
    }

    // Generate overall digest summary
    const digestSummary = await this.emailAnalysis.generateDigestSummary(
      emailSummaries.map((s) => ({
        subject: s.subject,
        summary: s.summary,
        category: s.category,
        priority: s.priority,
      })),
    );

    // Save digest and summaries to database
    const digest = await this.prisma.emailDigest.create({
      data: {
        userId,
        totalEmails: emailSummaries.length,
        summaryText: digestSummary,
        summaries: {
          create: emailSummaries,
        },
      },
      include: {
        summaries: true,
      },
    });

    // Mark emails as read in Gmail
    for (const emailId of processedEmailIds) {
      try {
        await this.gmailService.markAsRead(emailId);
      } catch (error) {
        this.logger.error(`Failed to mark email ${emailId} as read:`, error);
      }
    }
    this.logger.log(
      `Email digest completed for user: ${userId}. Processed ${emailSummaries.length} emails.`,
    );

    return {
      id: digest.id,
      totalEmails: digest.totalEmails,
      summaryText: digest.summaryText,
      createdAt: digest.createdAt,
      summaries: digest.summaries.map((s) => ({
        id: s.id,
        senderEmail: s.senderEmail,
        senderName: s.senderName,
        subject: s.subject,
        summary: s.summary,
        category: s.category,
        priority: s.priority,
        actionRequired: s.actionRequired,
        sentiment: s.sentiment,
      })),
    };
  }

  async getDigestHistory(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [digests, total] = await Promise.all([
      this.prisma.emailDigest.findMany({
        where: { userId },
        include: {
          summaries: {
            select: {
              id: true,
              subject: true,
              category: true,
              priority: true,
              actionRequired: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailDigest.count({ where: { userId } }),
    ]);

    return {
      digests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDigestDetails(userId: string, digestId: string) {
    const digest = await this.prisma.emailDigest.findFirst({
      where: { id: digestId, userId },
      include: {
        summaries: true,
      },
    });

    if (!digest) {
      throw new NotFoundException('Digest not found');
    }

    return digest;
  }

  async deleteDigest(userId: string, digestId: string) {
    const digest = await this.prisma.emailDigest.findFirst({
      where: { id: digestId, userId },
    });

    if (!digest) {
      throw new NotFoundException('Digest not found');
    }

    await this.prisma.emailDigest.delete({
      where: { id: digestId },
    });

    return { message: 'Digest deleted successfully' };
  }

  // Scheduled job: 8:00 AM and 8:00 PM
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  @Cron(CronExpression.EVERY_DAY_AT_8PM)
  async scheduledEmailDigest() {
    this.logger.log('Running scheduled email digest');

    // Get all users with active Gmail connections
    const connections = await this.prisma.gmailConnection.findMany({
      where: { connected: true },
      include: { user: true },
    });

    for (const connection of connections) {
      try {
        await this.runEmailDigest(connection.userId);
        this.logger.log(
          `Scheduled digest completed for user: ${connection.userId}`,
        );
      } catch (error) {
        this.logger.error(
          `Scheduled digest failed for user ${connection.userId}:`,
          error,
        );
      }
    }
  }
}
