// Reads all configuration from environment variables. Nothing secret is ever
// hardcoded: the JWT secret and AWS credentials come from the environment
// (locally from backend/.env, on AWS from Elastic Beanstalk environment
// properties and the EC2 instance role).

const crypto = require('node:crypto');
const path = require('node:path');

function toBool(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProduction) {
      throw new Error('JWT_SECRET must be set when NODE_ENV=production');
    }
    // Development/test convenience: a random secret means users are logged
    // out whenever the server restarts, which is acceptable locally.
    jwtSecret = crypto.randomBytes(32).toString('hex');
  }
  if (isProduction && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production');
  }

  const dbDriver = env.DB_DRIVER || (isProduction ? 'dynamodb' : 'local');
  if (!['local', 'dynamodb'].includes(dbDriver)) {
    throw new Error(`Unsupported DB_DRIVER "${dbDriver}". Use "local" or "dynamodb".`);
  }

  return {
    nodeEnv,
    isProduction,
    isTest,
    port: Number.parseInt(env.PORT || '8080', 10),
    appVersion: env.APP_VERSION || 'dev',
    logLevel: env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    // Secure cookies are only sent over HTTPS. The single-instance Elastic
    // Beanstalk URL is plain HTTP, so this must be switchable.
    cookieSecure: toBool(env.COOKIE_SECURE, isProduction),
    corsOrigins: toList(env.CORS_ORIGINS),
    authRateLimitMax: Number.parseInt(env.AUTH_RATE_LIMIT_MAX || (isTest ? '1000' : '20'), 10),
    staticDir: env.STATIC_DIR || path.join(__dirname, '..', 'public'),
    db: {
      driver: dbDriver,
      localFile:
        env.LOCAL_DB_FILE === undefined
          ? path.join(__dirname, '..', 'data', 'local-db.json')
          : env.LOCAL_DB_FILE,
      region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1',
      endpoint: env.DYNAMODB_ENDPOINT || undefined,
      usersTable: env.USERS_TABLE || 'scc-users',
      complaintsTable: env.COMPLAINTS_TABLE || 'scc-complaints',
    },
  };
}

module.exports = { loadConfig };
