import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export const METRICS_REGISTRY = new Registry();

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;
  readonly workerJobsTotal: Counter<string>;
  readonly workerJobsFailedTotal: Counter<string>;
  readonly workerJobsProcessing: Gauge<string>;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [METRICS_REGISTRY],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [METRICS_REGISTRY],
    });

    this.workerJobsTotal = new Counter({
      name: 'worker_jobs_total',
      help: 'Total worker jobs processed',
      labelNames: ['queue', 'status'],
      registers: [METRICS_REGISTRY],
    });

    this.workerJobsFailedTotal = new Counter({
      name: 'worker_jobs_failed_total',
      help: 'Total worker jobs failed',
      labelNames: ['queue'],
      registers: [METRICS_REGISTRY],
    });

    this.workerJobsProcessing = new Gauge({
      name: 'worker_jobs_processing',
      help: 'Worker jobs currently being processed',
      labelNames: ['queue'],
      registers: [METRICS_REGISTRY],
    });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: METRICS_REGISTRY });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ) {
    const status = String(statusCode);
    const labels = { method, route, status };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationMs / 1000);
  }

  async startJob(queue: string) {
    this.workerJobsProcessing.inc({ queue });
  }

  async finishJob(queue: string, success: boolean) {
    this.workerJobsProcessing.dec({ queue });
    this.workerJobsTotal.inc({ queue, status: success ? 'success' : 'failed' });
    if (!success) {
      this.workerJobsFailedTotal.inc({ queue });
    }
  }
}
