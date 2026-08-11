import * as winston from 'winston';
import TransportStream from 'winston-transport';

type LokiPushPayload = {
  streams: Array<{
    stream: Record<string, string>;
    values: Array<[string, string]>;
  }>;
};

type HttpLogMeta = {
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
};

function formatLokiLine(
  info: winston.Logform.TransformableInfo & HttpLogMeta,
): string {
  const { message, context, method, url, statusCode, duration, level } = info;

  if (context === 'HTTP' && method && url != null && statusCode != null) {
    const ms = duration ?? 0;
    return `LOG [HTTP] ${method} ${url} ${statusCode} ${ms}ms`;
  }

  const tag = context ? `[${context}]` : '[APP]';
  const lvl = level ? String(level).toUpperCase() : 'INFO';
  return `${lvl} ${tag} ${message}`;
}

/**
 * Push logs directly to Loki (bypasses Promtail file-sync issues on Docker Desktop Mac).
 * HTTP access lines are stored as plain text (pino-style) for Grafana live tail.
 */
export class LokiTransport extends TransportStream {
  constructor(
    private readonly lokiUrl: string,
    private readonly service: string,
  ) {
    super();
  }

  log(info: winston.Logform.TransformableInfo, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const { context, method, statusCode, level } = info as winston.Logform.TransformableInfo &
      HttpLogMeta;
    const line = formatLokiLine(info as winston.Logform.TransformableInfo & HttpLogMeta);

    const labels: Record<string, string> = {
      service: this.service,
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'local',
      context: String(context ?? 'app'),
      level: String(level ?? 'info'),
    };

    if (context === 'HTTP' && method) {
      labels.method = method;
    }
    if (context === 'HTTP' && statusCode != null) {
      labels.status = String(statusCode);
    }

    const tsNs = `${Date.now()}000000`;
    const payload: LokiPushPayload = {
      streams: [
        {
          stream: labels,
          values: [[tsNs, line]],
        },
      ],
    };

    fetch(`${this.lokiUrl.replace(/\/$/, '')}/loki/api/v1/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Best-effort; never block the app on observability failures.
    });

    callback();
  }
}
