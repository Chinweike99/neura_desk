import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// import { GetUser } from '../auth/decorators/get-user.decorator';
import { ConnectGmailDto } from 'src/dtos/email.dto';
import { EmailAgentService } from '../service/email-agent.service';
import { GetUser } from 'src/auth/decorator/get-user.decorator';

@Controller('email-agent')
@UseGuards(AuthGuard('jwt'))
export class EmailAgentController {
  constructor(private readonly emailAgentService: EmailAgentService) {}

  @Post('connect')
  async connectGmail(
    @GetUser() user: any,
    @Body() connectGmailDto: ConnectGmailDto,
  ) {
    return this.emailAgentService.connectGmail(
      user.id,
      connectGmailDto.accessToken,
      connectGmailDto.refreshToken,
      connectGmailDto.expiryDate,
    );
  }

  @Get('status')
  async getGmailStatus(@GetUser() user: any) {
    return this.emailAgentService.getGmailStatus(user.id);
  }

  @Post('run')
  async runEmailDigest(@GetUser() user: any) {
    return this.emailAgentService.runEmailDigest(user.id);
  }

  @Get('digests')
  async getDigestHistory(
    @GetUser() user: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.emailAgentService.getDigestHistory(user.id, page, limit);
  }

  @Get('digests/:id')
  async getDigestDetails(
    @GetUser() user: any,
    @Param('id') digestId: string,
  ) {
    return this.emailAgentService.getDigestDetails(user.id, digestId);
  }

  @Delete('digests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDigest(
    @GetUser() user: any,
    @Param('id') digestId: string,
  ) {
    return this.emailAgentService.deleteDigest(user.id, digestId);
  }
}