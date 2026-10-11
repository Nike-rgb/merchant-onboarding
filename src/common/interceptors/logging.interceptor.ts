import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs one line per HTTP request with method, path, status and duration.
 * Deliberately records no bodies/headers so credentials and tokens never
 * reach the logs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<Response>();
          this.logger.log(
            `${method} ${url} ${res.statusCode} ${Date.now() - start}ms`,
          );
        },
        error: (err: unknown) => {
          // Handler/service errors (404, 400, object-level 403) terminate
          // before a response is written, so read the status off the
          // exception. (Guard-level 401/403 short-circuit before interceptors
          // run and are reported by the exception filter instead.)
          const status = err instanceof HttpException ? err.getStatus() : 500;
          this.logger.warn(
            `${method} ${url} ${status} ${Date.now() - start}ms`,
          );
        },
      }),
    );
  }
}
