import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Use real client IP behind Render's proxy (requires trust proxy = 1 in app.ts)
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
  message: {
    success: false,
    error: 'Too many requests, please try again in a minute',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (was 1 minute — too tight for production behind proxy)
  max: 50,                    // 50 auth attempts per IP per 15 min (was 10/min)
  standardHeaders: true,
  legacyHeaders: false,
  // Use real client IP behind Render's proxy (requires trust proxy = 1 in app.ts)
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});
