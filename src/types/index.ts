export interface EmailSummary {
  emailId: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  summary: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  actionRequired: boolean;
  sentiment: 'positive' | 'negative' | 'neutral';
}