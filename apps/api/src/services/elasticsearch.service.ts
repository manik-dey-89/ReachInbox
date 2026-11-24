import { esClient } from '../config/elasticsearch';
import type { EmailSearchDocument, SearchEmailsRequest, SearchEmailsResponse } from '@reachinbox/shared';
import logger from '../utils/logger';

const DEGRADED_RESPONSE: SearchEmailsResponse = {
  hits: [],
  total: 0,
  page: 1,
  pageSize: 10,
  degraded: true,
};

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
      logger.error('ES indexEmail failed', { index, docId: doc.id, error: (err as Error).message });
    }
  }

  async searchEmails(
    userId: string,
    params: SearchEmailsRequest,
  ): Promise<SearchEmailsResponse> {
    const index = this.indexName(userId);
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const from = (page - 1) * pageSize;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const must: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filter: any[] = [];

      if (params.query) {
        must.push({
          multi_match: {
            query: params.query,
            fields: ['subject', 'recipientEmail', 'errorMessage'],
          },
        });
      }

      if (params.status) {
        filter.push({ term: { status: params.status } });
      }

      if (params.dateFrom || params.dateTo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const range: any = {};
        if (params.dateFrom) range.gte = params.dateFrom;
        if (params.dateTo) range.lte = params.dateTo;
        filter.push({ range: { sentAt: range } });
      }

      const query =
        must.length > 0 || filter.length > 0
          ? { bool: { must, filter } }
          : { match_all: {} };

      const response = await esClient.search<EmailSearchDocument>({
        index,
        from,
        size: pageSize,
        query,
        sort: [{ sentAt: { order: 'desc' } }],
      });

      const hits = response.hits.hits.map((h) => h._source as EmailSearchDocument);
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      return { hits, total, page, pageSize };
    } catch (err) {
      logger.warn('ES searchEmails failed — falling back to database', { index, error: (err as Error).message });
      return this.searchEmailsFromDb(userId, params);
    }
  }

  // Database fallback when Elasticsearch is unavailable
  private async searchEmailsFromDb(
    userId: string,
    params: SearchEmailsRequest,
  ): Promise<SearchEmailsResponse> {
    const { prisma } = await import('../config/database');
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const skip = (page - 1) * pageSize;

    try {
      // Build where clause - userId must be on the campaign relation
      // AND the text search is an OR across recipient email / campaign subject
      const whereJob: Record<string, unknown> = {
        campaign: { userId },
      };

      if (params.status) {
        whereJob.status = params.status;
      }

      if (params.dateFrom || params.dateTo) {
        const range: Record<string, Date> = {};
        if (params.dateFrom) range.gte = new Date(params.dateFrom);
        if (params.dateTo) range.lte = new Date(params.dateTo);
        whereJob.processedAt = range;
      }

      // Text search: use AND with the userId constraint via nested where
      // We need campaign.userId AND (recipient.email LIKE q OR campaign.subject LIKE q)
      if (params.query) {
        const q = params.query.toLowerCase();
        // Override the where to use AND combination properly
        const textFilter = {
          AND: [
            { campaign: { userId } },
            ...(params.status ? [{ status: params.status }] : []),
            ...(whereJob.processedAt ? [{ processedAt: whereJob.processedAt }] : []),
            {
              OR: [
                { recipient: { email: { contains: q, mode: 'insensitive' as const } } },
                { campaign: { subject: { contains: q, mode: 'insensitive' as const } } },
              ],
            },
          ],
        };

        const [jobs, total] = await Promise.all([
          prisma.emailJob.findMany({
            where: textFilter,
            include: {
              recipient: { select: { email: true, name: true } },
              campaign: { select: { subject: true } },
            },
            orderBy: { createdAt: 'desc' as const },
            skip,
            take: pageSize,
          }),
          prisma.emailJob.count({ where: textFilter }),
        ]);

        const hits: EmailSearchDocument[] = jobs.map((job) => ({
          id: job.id,
          campaignId: job.campaignId,
          recipientEmail: job.recipient?.email ?? '',
          subject: (job.campaign as { subject: string } | null)?.subject ?? '',
          status: job.status,
          scheduledAt: job.scheduledFor?.toISOString() ?? null,
          sentAt: job.processedAt?.toISOString() ?? null,
          errorMessage: job.lastError ?? null,
        }));

        return { hits, total, page, pageSize, degraded: true };
      }

      const [jobs, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereJob,
          include: {
            recipient: { select: { email: true, name: true } },
            campaign: { select: { subject: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.emailJob.count({ where: whereJob }),
      ]);

      const hits: EmailSearchDocument[] = jobs.map((job) => ({
        id: job.id,
        campaignId: job.campaignId,
        recipientEmail: job.recipient?.email ?? '',
        subject: job.campaign?.subject ?? '',
        status: job.status,
        scheduledAt: job.scheduledFor?.toISOString() ?? null,
        sentAt: job.processedAt?.toISOString() ?? null,
        errorMessage: job.lastError ?? null,
      }));

      return { hits, total, page, pageSize, degraded: true };
    } catch (dbErr) {
      logger.error('DB fallback search also failed', { error: (dbErr as Error).message });
      return { hits: [], total: 0, page, pageSize, degraded: true };
    }
  }

  async deleteEmail(userId: string, docId: string): Promise<void> {
    const index = this.indexName(userId);
    try {
      await esClient.delete({ index, id: docId });
    } catch (err) {
      logger.error('ES deleteEmail failed', { index, docId, error: (err as Error).message });
    }
  }
}

export const elasticsearchService = new ElasticsearchService();
