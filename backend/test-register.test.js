const request = require('supertest');
const app = require('./src/app');

process.env.JWT_SECRET = 'test-secret';

// Mock Prisma
jest.mock('./src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    }
  }
}));

const { prisma } = require('./src/config/database');

describe('POST /api/auth/register', () => {
  it('should register a new user successfully', async () => {
    const mockUser = {
      id: 'uuid-1234',
      name: 'Rahul Demo',
      email: 'rahul.demo@example.com',
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Rahul Demo',
        email: 'rahul.demo@example.com',
        password: 'DemoPassword123!'
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        user: mockUser,
        token: expect.any(String)
      }
    });
  });

  it('should return 409 if email exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Rahul Demo',
        email: 'rahul.demo@example.com',
        password: 'DemoPassword123!'
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('should return 400 if validation fails', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: '', // Invalid name
        email: 'invalid-email',
        password: 'short'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
