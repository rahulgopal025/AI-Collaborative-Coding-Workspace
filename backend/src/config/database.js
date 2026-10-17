/**
 * Prisma database client singleton.
 * Ensures only one PrismaClient instance exists across the application.
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../common/utils/logger');

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (event) => {
    if (event.duration > 100) {
      logger.warn({ duration: event.duration, query: event.query }, 'Slow query detected');
    }
  });
}

prisma.$on('error', (event) => {
  logger.error({ message: event.message }, 'Prisma error');
});

/**
 * Test the database connection.
 * Call this at server startup to fail fast if the database is unreachable.
 */
async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to connect to database');
    process.exit(1);
  }
}

/**
 * Gracefully disconnect from the database.
 * Call this during server shutdown.
 */
async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
