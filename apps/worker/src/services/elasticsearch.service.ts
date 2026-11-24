import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import logger from '../utils/logger';
import type { EmailSearchDocument } from '../shared-index';

const esClient = new Client({
  node: config.elasticsearchUrl,
  requestTimeout: 10000,
  sniffOnStart: false,
});

// Test connectivity at startup but do not throw — Elasticsearch downtime
// must not prevent the worker from processing jobs.
esClient.ping().then(() => {
  logger.info('Elasticsearch connected', { node: config.elasticsearchUrl });
}).catch((err: Error) => {
  logger.warn('Elasticsearch unavailable at startup — indexing will be degraded', {
    error: err.message,
  });
});

export class ElasticsearchService {
  private indexName(userId: string): string {
    return `emails_${userId}`;
  }

  async ensureIndex(userId: string): Promise<void> {
    const index = this.indexName(userId);
    try {
      const exists = await esClient.indices.exists({ index });
      if (exists) return;

      await esClient.indices.create({
        index,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            recipientEmail: { type: 'keyword' },
            subject: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            errorMessage: { type: 'text' },
          },
        },
      });
    } catch (err) {
      logger.error('ES ensureIndex failed', { index, error: (err as Error).message });
    }
  }

  async indexEmail(userId: string, doc: EmailSearchDocument): Promise<void> {
    const index = this.indexName(userId);
    try {
      await this.ensureIndex(userId);
      await esClient.index({
        index,
        id: doc.id,
        document: doc,
      });
    } catch (err) {
      // Graceful degradation: log and continue; DB is the source of truth.
      logger.error('ES indexEmail failed — continuing without indexing', {
        index,
        docId: doc.id,
        error: (err as Error).message,
      });
    }
  }
}

export const elasticsearchService = new ElasticsearchService();
