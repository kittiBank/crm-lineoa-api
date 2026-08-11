import { createServer, IncomingMessage, ServerResponse } from 'http';
import { METRICS_REGISTRY } from './metrics.service';

export function startMetricsServer(port: number): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      const metrics = await METRICS_REGISTRY.metrics();
      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      });
      res.end(metrics);
      return;
    }

    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`Metrics server listening on http://localhost:${port}/metrics`);
  });
}
