const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { verifyPasswordAndCheckUpgrade, hashPassword } = require('../../src/common/utils/password');

describe('Authentication and Legacy Hash Regression Tests', () => {
  const testUsersToCleanup = [];

  afterAll(async () => {
    // Clean up any test users created during this test suite
    if (testUsersToCleanup.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUsersToCleanup } },
      }).catch(() => {});
    }
  });

  describe('Password utility: verifyPasswordAndCheckUpgrade', () => {
    it('verifies standard 12-round bcrypt without needing upgrade', async () => {
      const plain = 'MySecret123!';
      const hash = await hashPassword(plain);
      const result = await verifyPasswordAndCheckUpgrade(plain, hash);
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(false);
    });

    it('verifies lower-round (e.g. 10 rounds) bcrypt and flags for upgrade', async () => {
      const plain = 'LegacyBcryptPwd1!';
      const lowRoundHash = await bcrypt.hash(plain, 10);
      const result = await verifyPasswordAndCheckUpgrade(plain, lowRoundHash);
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('verifies legacy SHA-256 hash and flags for upgrade', async () => {
      const plain = 'Sha256Password!';
      const sha256Hash = crypto.createHash('sha256').update(plain).digest('hex');
      const result = await verifyPasswordAndCheckUpgrade(plain, sha256Hash);
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('verifies legacy MD5 hash and flags for upgrade', async () => {
      const plain = 'Md5Password!';
      const md5Hash = crypto.createHash('md5').update(plain).digest('hex');
      const result = await verifyPasswordAndCheckUpgrade(plain, md5Hash);
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('verifies legacy plaintext password and flags for upgrade', async () => {
      const plain = 'PlaintextLegacy123!';
      const result = await verifyPasswordAndCheckUpgrade(plain, plain);
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('verifies password with accidental whitespace on input', async () => {
      const plain = 'StrictPassword123!';
      const hash = await hashPassword(plain);
      const result = await verifyPasswordAndCheckUpgrade('   ' + plain + '   ', hash);
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await hashPassword('CorrectPassword1!');
      const result = await verifyPasswordAndCheckUpgrade('WrongPassword2!', hash);
      expect(result.isValid).toBe(false);
      expect(result.needsUpgrade).toBe(false);
    });
  });

  describe('API: /api/auth/login and /api/auth/register', () => {
    it('authenticates existing account with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'rg7883230@gmail.com',
          password: 'Rahul@123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('rg7883230@gmail.com');
      expect(response.body.data.token).toBeDefined();
    });

    it('authenticates newly registered account with valid credentials', async () => {
      const uniqueSuffix = Date.now();
      const testEmail = `regression.new.${uniqueSuffix}@example.com`;
      const testPassword = 'SecurePassword123!';

      // Register new user
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Regression User',
          email: testEmail,
          password: testPassword,
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      testUsersToCleanup.push(regRes.body.data.user.id);

      // Log in with new user
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.email).toBe(testEmail.toLowerCase());
    });

    it('returns 401 AUTH_INVALID_CREDENTIALS for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'rg7883230@gmail.com',
          password: 'IncorrectPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 401 AUTH_INVALID_CREDENTIALS for unknown email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent.user.9999@example.com',
          password: 'SomePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('handles email casing and whitespace normalization during login', async () => {
      // Test uppercase and leading/trailing whitespace
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '   Rg7883230@Gmail.Com   ',
          password: 'Rahul@123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('rg7883230@gmail.com');
    });

    it('authenticates a legacy SHA-256 account and transparently upgrades hash to bcrypt in database', async () => {
      const uniqueSuffix = Date.now();
      const legacyEmail = `legacy.sha256.${uniqueSuffix}@example.com`;
      const rawPassword = 'LegacyShaPassword123!';
      const sha256Hash = crypto.createHash('sha256').update(rawPassword).digest('hex');

      // Create a legacy user directly in DB with SHA-256 password hash
      const legacyUser = await prisma.user.create({
        data: {
          name: 'Legacy SHA User',
          email: legacyEmail,
          password: sha256Hash,
        },
      });
      testUsersToCleanup.push(legacyUser.id);

      // Verify DB currently has SHA-256 hash (64 hex characters)
      expect(legacyUser.password).toBe(sha256Hash);

      // Login with valid credentials
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: legacyEmail,
          password: rawPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);

      // Fetch user from DB to verify password hash was transparently upgraded to standard bcrypt
      const updatedUser = await prisma.user.findUnique({
        where: { id: legacyUser.id },
      });

      expect(updatedUser.password).not.toBe(sha256Hash);
      expect(updatedUser.password.startsWith('$2b$12$')).toBe(true);

      // Subsequent login using updated bcrypt hash succeeds
      const loginAgainRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: legacyEmail,
          password: rawPassword,
        });

      expect(loginAgainRes.status).toBe(200);
      expect(loginAgainRes.body.success).toBe(true);
    });

    it('authenticates an account where email was stored in mixed case and normalizes it', async () => {
      const uniqueSuffix = Date.now();
      const mixedCaseEmail = `MixedCase.${uniqueSuffix}@Example.COM`;
      const rawPassword = 'MixedCasePassword123!';
      const bHash = await hashPassword(rawPassword);

      const user = await prisma.user.create({
        data: {
          name: 'Mixed Case User',
          email: mixedCaseEmail,
          password: bHash,
        },
      });
      testUsersToCleanup.push(user.id);

      // User logs in using lowercase or uppercase
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: mixedCaseEmail.toLowerCase(),
          password: rawPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);

      // Check that the database normalized the email to lowercase
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser.email).toBe(mixedCaseEmail.toLowerCase());
    });

    it('allows password reset via /api/auth/reset-password for account recovery', async () => {
      const uniqueSuffix = Date.now();
      const testEmail = `recovery.user.${uniqueSuffix}@example.com`;
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewSecretPassword123!';

      const user = await prisma.user.create({
        data: {
          name: 'Recovery User',
          email: testEmail,
          password: await hashPassword(oldPassword),
        },
      });
      testUsersToCleanup.push(user.id);

      // Reset password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: testEmail.toUpperCase(),
          newPassword: newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Login with old password fails
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: oldPassword,
        });
      expect(oldLoginRes.status).toBe(401);

      // Login with new password succeeds
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
    });
  });
});
