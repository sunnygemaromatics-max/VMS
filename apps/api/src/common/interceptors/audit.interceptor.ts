import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../platform/prisma/prisma.service';

// Methods/paths we don't want flooding the audit table.
const SKIP = new Set(['GET']);
const SKIP_PATHS = [/^\/health/, /^\/$/];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();
    const method: string = req.method;
    const path: string = req.originalUrl || req.url;

    if (SKIP.has(method) || SKIP_PATHS.some((re) => re.test(path))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => this.persist(req, res, path, method, start, res.statusCode ?? 200),
        error: (err) => this.persist(req, res, path, method, start, err?.status ?? 500),
      }),
    );
  }

  private persist(
    req: any,
    _res: any,
    path: string,
    method: string,
    start: number,
    status: number,
  ) {
    const user = req.user;
    this.prisma.auditLog
      .create({
        data: {
          actorId: user?.userId ?? null,
          actorEmail: user?.email ?? null,
          actorRole: user?.role ?? null,
          method,
          path: path.slice(0, 500),
          status,
          ipAddress: (req.ip || req.headers['x-forwarded-for'] || '').toString().slice(0, 64) || null,
          userAgent: (req.headers['user-agent'] || '').toString().slice(0, 500) || null,
          durationMs: Date.now() - start,
        },
      })
      .catch(() => {
        // Audit failures must never break the request.
      });
  }
}
