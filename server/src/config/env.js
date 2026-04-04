import 'dotenv/config';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set. Server cannot start.');
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 3001,
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
