// Minimal structured logger. Each log line is a single JSON object written to
// stdout/stderr. Docker captures these streams, Elastic Beanstalk writes them
// to /var/log/eb-docker/containers/eb-current-app/, and log streaming ships
// them to Amazon CloudWatch Logs where they can be searched.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function createLogger(level = 'info', baseFields = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function write(lvl, message, fields = {}) {
    if (LEVELS[lvl] < threshold) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      message,
      ...baseFields,
      ...fields,
    };
    const line = JSON.stringify(entry);
    if (LEVELS[lvl] >= LEVELS.warn) {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
  };
}

module.exports = { createLogger };
