import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './env';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channels';
import modelRoutes from './routes/models';
import tokenRoutes from './routes/tokens';
import usageRoutes from './routes/usage';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import proxyRoutes from './routes/proxy';
import newapiChannelRoutes from './routes/newapiChannels';
import newapiUserRoutes from './routes/newapiUsers';
import newapiGroupRoutes from './routes/newapiGroups';
import { adminAuth } from './middleware/adminAuth';

const app = new Hono<AppEnv>({ strict: false });

app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowed = c.env.CORS_ORIGIN ?? '*';
      return allowed === '*' ? '*' : allowed.split(',').map((item) => item.trim());
    },
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-admin-token', 'New-Api-User'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);
app.use(
  '/v1/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    allowMethods: ['GET', 'POST', 'OPTIONS']
  })
);

app.use('/api/*', async (c, next) => {
  if (
    c.req.path === '/api/auth/login' ||
    c.req.path.startsWith('/api/channel') ||
    c.req.path.startsWith('/api/user') ||
    c.req.path.startsWith('/api/group')
  ) {
    return next();
  }
  return adminAuth(c, next);
});

app.get('/health', (c) => c.json({ ok: true }));

app.route('/api/auth', authRoutes);
app.route('/api/channels', channelRoutes);
app.route('/api/models', modelRoutes);
app.route('/api/tokens', tokenRoutes);
app.route('/api/usage', usageRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/channel', newapiChannelRoutes);
app.route('/api/user', newapiUserRoutes);
app.route('/api/group', newapiGroupRoutes);

app.route('/v1', proxyRoutes);

export default app;
