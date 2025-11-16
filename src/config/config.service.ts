import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

get databaseUrl(): string {
  const url = this.configService.get<string>('DATABASE_URL');
  if (!url) {
    throw new Error('DATABASE_URL is not defined');
  }
  return url;
}

  get jwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    return secret;
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '7d');
  }

  get gmailClientId(): string {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    if (!clientId) {
      throw new Error('GMAIL_CLIENT_ID is not defined');
    }
    return clientId;
  }

  get gmailClientSecret(): string {
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    if (!clientSecret) {
      throw new Error('GMAIL_CLIENT_SECRET is not defined');
    }
    return clientSecret;
  }

  get gmailRedirectUri(): string {
    const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI');
    if (!redirectUri) {
      throw new Error('GMAIL_REDIRECT_URI is not defined');
    }
    return redirectUri;
  }

  get twitterApiKey(): string {
    const twitterApiKey = this.configService.get<string>('TWITTER_API_KEY');
    if (!twitterApiKey) {
      throw new Error('TWITTER_API_KEY is not defined');
    }
    return twitterApiKey;
  }

  get twitterApiSecret(): string {
    const twitterApiSecret = this.configService.get<string>('TWITTER_API_SECRET');
    if (!twitterApiSecret) {
      throw new Error('TWITTER_API_SECRET is not defined');
    } 
    return twitterApiSecret;
  }

  get geminiApiKey(): string {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not defined');
    }
    return geminiApiKey;
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
  }

  isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}