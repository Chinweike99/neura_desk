import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { google, gmail_v1, Auth } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import {
  GmailEmail,
  GmailMessagesListResponse,
  GmailMessageResponse,
  GmailMessageHeader,
  GmailMessage,
  GmailMessagePart,
} from 'src/types';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private oauth2Client: Auth.OAuth2Client;

  constructor(private configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GMAIL_CLIENT_ID'),
      this.configService.get<string>('GMAIL_CLIENT_SECRET'),
      this.configService.get<string>('GMAIL_REDIRECT_URI'),
    );
  }

  setCredentials(accessToken: string, refreshToken?: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  async getUnreadEmails(lastChecked?: Date): Promise<GmailEmail[]> {
    try {
      const gmail: gmail_v1.Gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      // Build query for unread emails
      let query = 'is:unread';
      if (lastChecked) {
        const timestamp = Math.floor(lastChecked.getTime() / 1000);
        query += ` after:${timestamp}`;
      }

      const response: GmailMessagesListResponse =
        await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 50,
        });

      const messages = response.data.messages || [];
      const emails: GmailEmail[] = [];

      for (const message of messages) {
        try {
          if (message.id) {
            const email = await this.getMessageDetails(message.id);
            if (email) {
              emails.push(email);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to process message ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      this.logger.error('Error fetching unread emails:', error);
      throw new BadRequestException('Failed to fetch emails from Gmail');
    }
  }

  private async getMessageDetails(
    messageId: string,
  ): Promise<GmailEmail | null> {
    try {
      const gmail: gmail_v1.Gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      const response: GmailMessageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload?.headers || [];

      const subject = this.findHeaderValue(headers, 'Subject') || 'No Subject';
      const fromHeader = this.findHeaderValue(headers, 'From') || '';
      const date = this.findHeaderValue(headers, 'Date') || '';

      // Parse sender information
      const senderInfo = this.parseSenderInfo(fromHeader);

      // Extract email body
      const body = this.extractEmailBody(message);

      return {
        id: messageId,
        threadId: message.threadId || '',
        subject,
        body,
        sender: senderInfo,
        date,
      };
    } catch (error) {
      this.logger.error(
        `Error getting message details for ${messageId}:`,
        error,
      );
      return null;
    }
  }

  private findHeaderValue(
    headers: GmailMessageHeader[],
    headerName: string,
  ): string {
    const header = headers.find(
      (h: GmailMessageHeader) =>
        h.name?.toLowerCase() === headerName.toLowerCase(),
    );
    return header?.value?.trim() || '';
  }

  private parseSenderInfo(fromHeader: string): { name: string; email: string } {
    const senderMatch = fromHeader.match(
      /(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)/,
    );

    if (senderMatch) {
      return {
        name: senderMatch[1]?.trim() || '',
        email: senderMatch[2]?.trim() || fromHeader,
      };
    }

    return {
      name: '',
      email: fromHeader,
    };
  }

  private extractEmailBody(message: GmailMessage): string {
    try {
      if (!message.payload) {
        return 'No content available';
      }

      // Handle multipart messages
      if (message.payload.parts && message.payload.parts.length > 0) {
        const plainPart = this.findMessagePart(
          message.payload.parts,
          'text/plain',
        );
        const htmlPart = this.findMessagePart(
          message.payload.parts,
          'text/html',
        );

        if (plainPart && plainPart.body?.data) {
          return this.decodeBase64(plainPart.body.data);
        }

        if (htmlPart && htmlPart.body?.data) {
          const htmlContent = this.decodeBase64(htmlPart.body.data);
          return this.convertHtmlToText(htmlContent);
        }
      }

      // Handle single part messages
      if (message.payload.body?.data) {
        return this.decodeBase64(message.payload.body.data);
      }

      return 'No content available';
    } catch (error) {
      this.logger.error('Error extracting email body:', error);
      return 'Unable to extract email content';
    }
  }

  private findMessagePart(
    parts: GmailMessagePart[],
    mimeType: string,
  ): GmailMessagePart | null {
    for (const part of parts) {
      if (part.mimeType === mimeType) {
        return part;
      }

      // Recursively search nested parts
      if (part.parts && part.parts.length > 0) {
        const foundPart = this.findMessagePart(part.parts, mimeType);
        if (foundPart) {
          return foundPart;
        }
      }
    }

    return null;
  }

  private decodeBase64(data: string): string {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  private convertHtmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      const gmail: gmail_v1.Gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    } catch (error) {
      this.logger.error(`Error marking message ${messageId} as read:`, error);
      throw new BadRequestException('Failed to mark email as read');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const gmail: gmail_v1.Gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      await gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch (error) {
      this.logger.error('Gmail connection test failed:', error);
      return false;
    }
  }
}
