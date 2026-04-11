import express from 'express';
import cors from 'cors';
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

const app = express();

app.use(cors({ origin: config.clientUrl }));
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

app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`DailyForge API running on 0.0.0.0:${config.port}`);
});
