export class ConnectGmailDto {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
}

export class CreateEmailDigestDto {
  id: string;
  totalEmails: number;
  summaryText: string;
  createdAt: Date;
  summaries: Array<{
    id: string;
    senderEmail: string;
    senderName: string;
    subject: string;
    summary: string;
    category: string;
    priority: string;
    actionRequired: boolean;
    sentiment: string;
  }>;
}