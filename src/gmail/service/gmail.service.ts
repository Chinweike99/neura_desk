import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';

interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  sender: { name: string; email: string };
  date: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private oauth2Client: any;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.gmailClientId,
      this.configService.gmailClientSecret,
      this.configService.gmailRedirectUri,
    );
  }

  async setCredentialsForUser(userId: string) {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.connected) {
      throw new BadRequestException('Gmail not connected for user');
    }

    this.oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
    });

    // Set up automatic token refresh
    this.oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Store the new refresh token
        await this.prisma.gmailConnection.update({
          where: { userId },
          data: {
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            expiryDate: new Date(Date.now() + (tokens.expiry_date || 3600) * 1000),
          },
        });
      }
    });
  }

  async refreshAccessToken(userId: string): Promise<boolean> {
    try {
      const connection = await this.prisma.gmailConnection.findUnique({
        where: { userId },
      });

      if (!connection) {
        return false;
      }

      this.oauth2Client.setCredentials({
        refresh_token: connection.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      await this.prisma.gmailConnection.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token,
          expiryDate: new Date(Date.now() + credentials.expires_in * 1000),
        },
      });

      this.logger.log(`Access token refreshed for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to refresh token for user ${userId}:`, error);
      
      // Mark connection as disconnected if refresh fails
      await this.prisma.gmailConnection.update({
        where: { userId },
        data: { connected: false },
      });
      
      return false;
    }
  }

  async getUnreadEmails(userId: string, lastChecked?: Date): Promise<GmailEmail[]> {
    await this.setCredentialsForUser(userId);

    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Build query for unread emails
      let query = 'is:unread';
      if (lastChecked) {
        const timestamp = Math.floor(lastChecked.getTime() / 1000);
        query += ` after:${timestamp}`;
      }

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      const messages = response.data.messages || [];
      const emails: GmailEmail[] = [];

      for (const message of messages) {
        try {
          const email = await this.getMessageDetails(message.id as string);
          if (email) {
            emails.push(email);
          }
        } catch (error) {
          this.logger.warn(`Failed to process message ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      this.logger.error('Error fetching unread emails:', error);
      
      // Try to refresh token if it's an auth error
      if (error.code === 401) {
        const refreshed = await this.refreshAccessToken(userId);
        if (refreshed) {
          // Retry the request
          return this.getUnreadEmails(userId, lastChecked);
        }
      }
      
      throw new BadRequestException('Failed to fetch emails from Gmail');
    }
  }

  private async getMessageDetails(messageId: string): Promise<GmailEmail | null> {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload?.headers || [];
      
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const fromHeader = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Parse sender information
      const senderMatch = fromHeader.match(/(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)/);
      const senderName = senderMatch?.[1]?.trim() || '';
      const senderEmail = senderMatch?.[2]?.trim() || fromHeader;

      // Extract email body
      const body = this.extractEmailBody(message);

      return {
        id: messageId,
        threadId: message.threadId as string,
        subject,
        body,
        sender: { name: senderName, email: senderEmail },
        date,
      };
    } catch (error) {
      this.logger.error(`Error getting message details for ${messageId}:`, error);
      return null;
    }
  }

  private extractEmailBody(message: any): string {
    try {
      if (message.payload.parts) {
        // Multipart message
        const htmlPart = message.payload.parts.find((part: any) => 
          part.mimeType === 'text/html'
        );
        const plainPart = message.payload.parts.find((part: any) => 
          part.mimeType === 'text/plain'
        );

        if (plainPart && plainPart.body.data) {
          return Buffer.from(plainPart.body.data, 'base64').toString('utf-8');
        }
        if (htmlPart && htmlPart.body.data) {
          const htmlContent = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
          // Simple HTML to text conversion
          return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }

      // Single part message
      if (message.payload.body?.data) {
        return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      }

      return 'No content available';
    } catch (error) {
      this.logger.error('Error extracting email body:', error);
      return 'Unable to extract email content';
    }
  }

  async markAsRead(userId: string, messageId: string): Promise<void> {
    await this.setCredentialsForUser(userId);

    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    } catch (error) {
      this.logger.error(`Error marking message ${messageId} as read:`, error);
      
      // Try to refresh token if it's an auth error
      if (error.code === 401) {
        const refreshed = await this.refreshAccessToken(userId);
        if (refreshed) {
          // Retry the request
          return this.markAsRead(userId, messageId);
        }
      }
      
      throw new BadRequestException('Failed to mark email as read');
    }
  }

  async testConnection(userId: string): Promise<boolean> {
    try {
      await this.setCredentialsForUser(userId);
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      await gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch (error) {
      this.logger.error('Gmail connection test failed:', error);
      return false;
    }
  }
}