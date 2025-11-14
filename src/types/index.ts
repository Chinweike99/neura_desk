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

export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  sender: { name: string; email: string };
  date: string;
}

export interface GmailMessageHeader {
  name?: string | null;
  value?: string | null;
}

export interface GmailMessagePart {
  mimeType?: string | null;
  body?: {
    data?: string | null;
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id?: string | null;
  threadId?: string | null;
  payload?: {
    headers?: GmailMessageHeader[];
    body?: {
      data?: string | null;
    };
    parts?: GmailMessagePart[];
  };
}

export interface GmailMessagesListResponse {
  data: {
    messages?: Array<{
      id?: string | null;
      threadId?: string | null;
    }>;
  };
}

export interface GmailMessageResponse {
  data: GmailMessage;
}
