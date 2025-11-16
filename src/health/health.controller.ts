import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  DiskHealthIndicator, 
  HealthCheck, 
  HealthCheckService, 
  HealthIndicatorResult,
  MemoryHealthIndicator, 
  TypeOrmHealthIndicator 
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),

      // Memory health check
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB threshold
      
      // Disk storage health check
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),

      // Custom database query check - FIXED
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            'custom-database': {
              status: 'up',
              message: 'Database query executed successfully'
            }
          };
        } catch (error) {
          return {
            'custom-database': {
              status: 'down',
              message: error.message
            }
          };
        }
      }
    ]);
  }

  @Get('simple')
  async simple() {
    const checks: {
      status: string;
      timestamp: string;
      uptime: number;
      database: string;
      error?: string;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'unknown',
    };

    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'connected';
    } catch (error: any) {
      checks.database = 'disconnected';
      checks.status = 'error';
      checks.error = error.message;
    }

    return checks;
  }

  @Get('detailed')
  async detailed() {
    const detailedCheck: {
      status: string;
      timestamp: string;
      uptime: number;
      environment: string;
      version: string;
      services: {
        database: { 
          status: string; 
          responseTime: number; 
          error?: string;
        };
        memory: { 
          status: string; 
          usage: number; 
          total?: number;
        };
        disk: { status: string };
      };
      error?: string;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: { status: 'checking', responseTime: 0 },
        memory: { status: 'checking', usage: 0 },
        disk: { status: 'checking' },
      },
    };

    // Database check with timing
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      detailedCheck.services.database.status = 'connected';
      detailedCheck.services.database.responseTime = Date.now() - dbStart;
    } catch (error: any) {
      detailedCheck.services.database.status = 'disconnected';
      detailedCheck.services.database.error = error.message;
      detailedCheck.status = 'error';
      detailedCheck.error = 'Database connection failed';
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();
    detailedCheck.services.memory.usage = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    detailedCheck.services.memory.total = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    detailedCheck.services.memory.status = 'ok';

    return detailedCheck;
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Database not available',
      };
    }
  }

  @Get('live')
  liveness() {
    return {
      status: 'live',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}