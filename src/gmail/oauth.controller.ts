import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/get-user.decorator';
import { EmailAgentService } from './service/email-agent.service';
import { ConfigService } from 'src/config/config.service';


@Controller('email-agent/oauth')
export class GmailOAuthController {
  private readonly gmailAuthUrl: string;

  constructor(
    private configService: ConfigService,
    private emailAgentService: EmailAgentService,
  ) {
    this.gmailAuthUrl = this.buildGmailAuthUrl();
  }

  private buildGmailAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.configService.gmailClientId,
      redirect_uri: this.configService.gmailRedirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // @Get('gmail')
  // @UseGuards(AuthGuard('jwt'))
  // async initiateGmailOAuth(@Res() res: Response) {
  //   // Redirect user to Google OAuth screen
  //   return res.redirect(this.gmailAuthUrl);
  // }


  @Get('gmail')
    @UseGuards(AuthGuard('jwt'))
    async initiateGmailOAuth(@GetUser() user, @Res() res: Response) {
      const url = `${this.gmailAuthUrl}&state=${user.id}`;
      return res.redirect(url);
    }


  // @UseGuards(AuthGuard('jwt'))
  @Get('gmail/callback')
  async handleGmailCallback(
    @GetUser() user: any,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.configService.frontendUrl}/settings?error=oauth_failed`);
    }

    try {
      const tokens = await this.exchangeCodeForTokens(code);
      
      await this.emailAgentService.connectGmail(
        user.id,
        tokens.access_token,
        tokens.refresh_token,
        new Date(Date.now() + tokens.expires_in * 1000),
      );

      return res.redirect(`${this.configService.frontendUrl}/settings?success=gmail_connected`);
    } catch (error) {
      console.error('Gmail OAuth error:', error);
      return res.redirect(`${this.configService.frontendUrl}/settings?error=oauth_failed`);
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.configService.gmailClientId,
        client_secret: this.configService.gmailClientSecret,
        code,
        redirect_uri: this.configService.gmailRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }
}