import { Client } from '@elastic/elasticsearch';
import { config } from './index';
import logger from '../utils/logger';

const esClient = new Client({
  node: config.elasticsearchUrl,
  requestTimeout: 10000,
  sniffOnStart: false,
});

// Test connectivity at startup but do not throw — Elasticsearch downtime
// must not prevent the API from starting.
esClient.ping().then(() => {
  logger.info('Elasticsearch connected', { node: config.elasticsearchUrl });
}).catch((err: Error) => {
  logger.warn('Elasticsearch unavailable at startup — search features will be degraded', {
    error: err.message,
  });
});

export { esClient };
