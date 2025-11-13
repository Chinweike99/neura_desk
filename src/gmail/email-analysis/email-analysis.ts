import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EmailAnalysisService {
  private readonly logger = new Logger(EmailAnalysisService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyzeEmail(emailContent: {
    subject: string;
    body: string;
    sender: string;
  }): Promise<{
    summary: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    actionRequired: boolean;
    sentiment: 'positive' | 'negative' | 'neutral';
  }> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
      });

      const prompt = `
Analyze this email and provide a structured response in JSON format:

Email Subject: ${emailContent.subject}
Email Body: ${emailContent.body}
Sender: ${emailContent.sender}

Please analyze and return ONLY valid JSON with these exact fields:
- summary: A concise 2-3 sentence summary of the email content
- category: One of: "work", "personal", "newsletter", "promotional", "social", "important", "spam", "other"
- priority: "high", "medium", or "low"
- actionRequired: boolean indicating if the email requires any action
- sentiment: "positive", "negative", or "neutral"

Be concise and accurate in your analysis. Focus on the actual content rather than assumptions.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        summary: analysis.summary,
        category: analysis.category,
        priority: analysis.priority,
        actionRequired: analysis.actionRequired,
        sentiment: analysis.sentiment,
      };
    } catch (error) {
      this.logger.error('Error analyzing email with AI:', error);
      // Return fallback analysis
      return {
        summary: `Email about: ${emailContent.subject}`,
        category: 'other',
        priority: 'medium',
        actionRequired: false,
        sentiment: 'neutral',
      };
    }
  }

  async generateDigestSummary(summaries: Array<{
    subject: string;
    summary: string;
    category: string;
    priority: string;
  }>): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
      });

      const emailList = summaries
        .map((s, i) => 
          `${i + 1}. Subject: ${s.subject}\n   Summary: ${s.summary}\n   Category: ${s.category}\n   Priority: ${s.priority}`
        )
        .join('\n\n');

      const prompt = `
Create a concise daily email digest summary based on these analyzed emails:

${emailList}

Provide a well-structured digest that:
1. Starts with a brief overview of the email volume and key categories
2. Highlights high-priority emails and action items
3. Groups emails by category where appropriate
4. Ends with any important follow-ups needed

Keep it professional and easy to scan. Maximum 300 words.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Error generating digest summary:', error);
      return `Digest of ${summaries.length} emails processed. ${summaries.filter(s => s.priority === 'high').length} require attention.`;
    }
  }
}