import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import workoutRoutes from './routes/workout.js';
import sessionRoutes from './routes/session.js';
import settingsRoutes from './routes/settings.js';
import mediaRoutes from './routes/media.js';
import breathworkRoutes from './routes/breathwork.js';
import yogaRoutes from './routes/yoga.js';
import progressRoutes from './routes/progress.js';
import bodyMeasurementsRoutes from './routes/bodyMeasurements.js';
import progressPhotosRoutes from './routes/progressPhotos.js';
import usersRoutes from './routes/users.js';
import suggestionsRoutes from './routes/suggestions.js';
import dashboardRoutes from './routes/dashboard.js';
import exercisesRoutes from './routes/exercises.js';
import routinesRoutes from './routes/routines.js';
import bodyMapRoutes from './routes/bodyMap.js';
import homeRoutes from './routes/home.js';

// S12-T7 prep: factor app construction so test harnesses can spawn an
// in-process Express instance via createApp() instead of running a real
// listener. Behavior when this file is the entry point is unchanged.
export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: true }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/workout', workoutRoutes);
  app.use('/api/session', sessionRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/breathwork', breathworkRoutes);
  app.use('/api/yoga', yogaRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/body-measurements', bodyMeasurementsRoutes);
  app.use('/api/progress-photos', progressPhotosRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/suggestions', suggestionsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/exercises', exercisesRoutes);
  app.use('/api/routines', routinesRoutes);
  app.use('/api/body-map', bodyMapRoutes);
  app.use('/api/home', homeRoutes);

  app.use(errorHandler);

  return app;
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntryPoint) {
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`DailyForge API running on 0.0.0.0:${config.port}`);
  });
}
