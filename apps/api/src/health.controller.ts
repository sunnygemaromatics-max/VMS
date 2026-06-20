import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return { status: 'ok', service: 'vms-api', time: new Date().toISOString() };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
