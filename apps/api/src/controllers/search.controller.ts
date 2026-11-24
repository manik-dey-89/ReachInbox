import type { Request, Response, NextFunction } from 'express';
import { elasticsearchService } from '../services/elasticsearch.service';
import type { SearchEmailsRequest } from '@reachinbox/shared';

export class SearchController {
  async searchEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;

      const params: SearchEmailsRequest = {
        query: req.query.query as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      };

      const result = await elasticsearchService.searchEmails(userId, params);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const searchController = new SearchController();
