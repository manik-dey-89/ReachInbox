import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import RedisStore from 'connect-redis';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config';
import { createRedisClient } from './config/redis';
import { emailQueue } from './config/queue';

import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth, requireAdmin } from './middleware/auth';
import { apiRateLimiter } from './middleware/rateLimiter';

import { userRepository } from './repositories/user.repository';
import { auditService } from './services/audit.service';
import { AuditAction } from '@reachinbox/shared';

import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import recipientRoutes from './routes/recipient.routes';
import jobRoutes from './routes/job.routes';
import senderRoutes from './routes/sender.routes';
import slackRoutes from './routes/slack.routes';
import searchRoutes from './routes/search.routes';
import dashboardRoutes from './routes/dashboard.routes';
import rateLimitRoutes from './routes/rateLimits.routes';
import healthRoutes from './routes/health.routes';

// ---------------------------------------------------------------------------
// Passport: Google OAuth Strategy
// ---------------------------------------------------------------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.googleCallbackUrl,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value ?? '';
        const user = await userRepository.upsertFromOAuth({
          email,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
          provider: 'GOOGLE',
          providerAccountId: profile.id,
          accessToken: _accessToken ?? undefined,
          refreshToken: _refreshToken ?? undefined,
        });

        await auditService.log(user.id, AuditAction.USER_LOGIN);

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userRepository.findById(id);
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------
export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Session with Redis store
  // ioredis is compatible with connect-redis when passed as `client`
  const sessionRedisClient = createRedisClient();
  const store = new RedisStore({ client: sessionRedisClient });

  app.use(
    session({
      store,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
        maxAge: config.sessionMaxAge,
        sameSite: config.isProduction ? 'strict' : 'lax',
      },
    }),
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  app.use('/health', healthRoutes);
  app.use('/auth', authRoutes);

  app.use('/api', apiRateLimiter);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/campaigns/:id/recipients', recipientRoutes);
  app.use('/api/campaigns/:id/jobs', jobRoutes);
  app.use('/api/senders', senderRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/rate-limits', rateLimitRoutes);

  // Bull Board (admin only)
  const bullBoardAdapter = new ExpressAdapter();
  bullBoardAdapter.setBasePath('/admin/queues');

  createBullBoard({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter: bullBoardAdapter,
  });

  app.use(
    '/admin/queues',
    requireAuth,
    requireAdmin,
    bullBoardAdapter.getRouter(),
  );

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  });

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
