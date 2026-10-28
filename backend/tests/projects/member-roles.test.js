const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { generateToken } = require('../../src/common/utils/jwt');
const { hashPassword } = require('../../src/common/utils/password');
const collabService = require('../../src/modules/collaboration/collaboration.service');
const { setupCollaborationGateway } = require('../../src/modules/collaboration/collaboration.gateway');
const { setIO } = require('../../src/config/socket');

describe('Project Member Role Management and Strict Role-Based Permissions', () => {
  jest.setTimeout(30000);

  let ownerUser;
  let editorUser;
  let viewerUser;
  let foreignUser;
  let ownerToken;
  let editorToken;
  let viewerToken;
  let foreignToken;

  let testProject;
  let foreignProject;
  let testFile;

  let mockIo;
  let emittedEvents = [];

  const cleanupUserIds = [];
  const cleanupProjectIds = [];

  beforeAll(async () => {
    // Setup mock Socket.IO to capture emitted events
    emittedEvents = [];
    mockIo = {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ room, event, data });
        },
      }),
      emit: (event, data) => {
        emittedEvents.push({ event, data });
      },
    };
    setIO(mockIo);

    // Create test users
    const pwdHash = await hashPassword('TestPassword123!');
    const timestamp = Date.now();

    ownerUser = await prisma.user.create({
      data: {
        name: 'Project Owner',
        email: `owner_${timestamp}@test.com`,
        password: pwdHash,
      },
    });
    cleanupUserIds.push(ownerUser.id);
    ownerToken = generateToken({ id: ownerUser.id, email: ownerUser.email });

    editorUser = await prisma.user.create({
      data: {
        name: 'Project Editor',
        email: `editor_${timestamp}@test.com`,
        password: pwdHash,
      },
    });
    cleanupUserIds.push(editorUser.id);
    editorToken = generateToken({ id: editorUser.id, email: editorUser.email });

    viewerUser = await prisma.user.create({
      data: {
        name: 'Project Viewer',
        email: `viewer_${timestamp}@test.com`,
        password: pwdHash,
      },
    });
    cleanupUserIds.push(viewerUser.id);
    viewerToken = generateToken({ id: viewerUser.id, email: viewerUser.email });

    foreignUser = await prisma.user.create({
      data: {
        name: 'Foreign User',
        email: `foreign_${timestamp}@test.com`,
        password: pwdHash,
      },
    });
    cleanupUserIds.push(foreignUser.id);
    foreignToken = generateToken({ id: foreignUser.id, email: foreignUser.email });

    // Create main test project with OWNER
    testProject = await prisma.project.create({
      data: {
        name: 'Role Permission Test Project',
        description: 'Testing strict role based permissions',
        members: {
          create: [
            { userId: ownerUser.id, role: 'OWNER' },
            { userId: editorUser.id, role: 'DEVELOPER' },
            { userId: viewerUser.id, role: 'VIEWER' },
          ],
        },
      },
    });
    cleanupProjectIds.push(testProject.id);

    // Create a second project for cross-project isolation tests
    foreignProject = await prisma.project.create({
      data: {
        name: 'Foreign Project',
        description: 'Unrelated project',
        members: {
          create: [
            { userId: foreignUser.id, role: 'OWNER' },
          ],
        },
      },
    });
    cleanupProjectIds.push(foreignProject.id);

    // Create a source file in the main test project
    testFile = await prisma.file.create({
      data: {
        projectId: testProject.id,
        name: 'index.js',
        content: 'console.log("hello world");',
        language: 'javascript',
      },
    });
  });

  afterAll(async () => {
    // Clean up projects (cascades to files, folders, members)
    if (cleanupProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: cleanupProjectIds } },
      }).catch(() => {});
    }

    // Clean up users
    if (cleanupUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: cleanupUserIds } },
      }).catch(() => {});
    }
  });

  beforeEach(() => {
    emittedEvents = [];
  });

  // ─── Scenario 1: Owner changes Viewer to Editor ───────────────────
  it('1. Owner successfully changes a member from Viewer to Editor (DEVELOPER)', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${viewerUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'DEVELOPER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('DEVELOPER');
    expect(res.body.data.userId).toBe(viewerUser.id);
    expect(res.body.data.user.name).toBe(viewerUser.name);

    // Verify DB persistence
    const updatedInDb = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: viewerUser.id, projectId: testProject.id } },
    });
    expect(updatedInDb.role).toBe('DEVELOPER');

    // Verify Socket.IO emission
    const roleEvent = emittedEvents.find(
      (e) => e.event === 'project:member_role_changed' && e.data.userId === viewerUser.id
    );
    expect(roleEvent).toBeDefined();
    expect(roleEvent.room).toBe(`project:${testProject.id}`);
    expect(roleEvent.data.role).toBe('DEVELOPER');
  });

  // ─── Scenario 2: Owner changes Editor to Viewer ───────────────────
  it('2. Owner successfully changes a member from Editor to Viewer (VIEWER)', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${editorUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('VIEWER');

    // Verify DB persistence
    const updatedInDb = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: editorUser.id, projectId: testProject.id } },
    });
    expect(updatedInDb.role).toBe('VIEWER');

    // Verify Socket.IO emission
    const roleEvent = emittedEvents.find(
      (e) => e.event === 'project:member_role_changed' && e.data.userId === editorUser.id
    );
    expect(roleEvent).toBeDefined();
    expect(roleEvent.data.role).toBe('VIEWER');

    // Restore editorUser back to DEVELOPER and viewerUser back to VIEWER for subsequent tests
    await prisma.projectMember.update({
      where: { userId_projectId: { userId: editorUser.id, projectId: testProject.id } },
      data: { role: 'DEVELOPER' },
    });
    await prisma.projectMember.update({
      where: { userId_projectId: { userId: viewerUser.id, projectId: testProject.id } },
      data: { role: 'VIEWER' },
    });
  });

  // ─── Scenario 3: Editor cannot change another member's role ──────
  it('3. An Editor cannot change another member\'s role (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${viewerUser.id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ role: 'DEVELOPER' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Verify DB role was NOT modified
    const memberInDb = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: viewerUser.id, projectId: testProject.id } },
    });
    expect(memberInDb.role).toBe('VIEWER');
  });

  // ─── Scenario 4: Viewer cannot modify files through direct backend API calls ──
  it('4. A Viewer cannot modify or create files through direct backend API calls (403 Forbidden)', async () => {
    // Attempt to update file
    const updateRes = await request(app)
      .put(`/api/files/${testFile.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ content: 'malicious modification by viewer' });

    expect(updateRes.status).toBe(403);

    // Attempt to create file
    const createRes = await request(app)
      .post(`/api/projects/${testProject.id}/files`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'unauthorized.js', content: 'test' });

    expect(createRes.status).toBe(403);

    // Attempt to delete file
    const deleteRes = await request(app)
      .delete(`/api/files/${testFile.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(deleteRes.status).toBe(403);
  });

  // ─── Scenario 5: Viewer cannot write to Yjs documents or use file-save APIs ──
  it('5. A Viewer cannot write to Yjs documents or force-save via collaboration service', async () => {
    const mockSocket = {
      id: 'mock-viewer-socket',
      userId: viewerUser.id,
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };

    // Attempt an editor update as Viewer
    const updateData = [1, 2, 3];
    await collabService.handleEditorUpdate(testFile.id, updateData, mockSocket, mockIo);

    // Socket should have received an error and update should NOT be broadcast
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'editor:error',
      expect.objectContaining({ message: expect.stringContaining('Viewer access: read-only mode') })
    );

    // Attempt an editor force save as Viewer
    await collabService.handleEditorSave(testFile.id, mockSocket);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'editor:error',
      expect.objectContaining({ message: expect.stringContaining('Viewer access: read-only mode') })
    );
  });

  // ─── Scenario 6: Viewer cannot execute code or access writable terminal ──
  it('6. A Viewer cannot execute code via the execution API', async () => {
    const res = await request(app)
      .post('/api/execution/run')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        projectId: testProject.id,
        language: 'javascript',
        sourceCode: 'console.log("hacked")',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── Scenario 7: Invalid roles are rejected ───────────────────────
  it('7. Invalid roles are rejected with 400 Bad Request', async () => {
    const invalidRoles = ['ADMIN', 'SUPERUSER', 'GUEST', 'ROOT', 'RANDOM'];
    for (const role of invalidRoles) {
      const res = await request(app)
        .put(`/api/projects/${testProject.id}/collaborators/${viewerUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  // ─── Scenario 8: Cross-project role changes are rejected ──────────
  it('8. A member from another project cannot have their role changed through this project', async () => {
    // foreignUser is only in foreignProject, NOT testProject
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${foreignUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'DEVELOPER' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Verify foreignUser's role in foreignProject was untouched
    const foreignMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: foreignUser.id, projectId: foreignProject.id } },
    });
    expect(foreignMembership.role).toBe('OWNER');
  });

  // ─── Scenario 9: Last owner cannot lose ownership / cannot change own role ──
  it('9. The last owner cannot accidentally lose ownership or change own role through this action', async () => {
    // Owner tries to change own role
    const selfRes = await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${ownerUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'DEVELOPER' });

    expect(selfRes.status).toBe(400);
    expect(selfRes.body.success).toBe(false);

    // Verify owner is still OWNER in database
    const ownerMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: ownerUser.id, projectId: testProject.id } },
    });
    expect(ownerMembership.role).toBe('OWNER');
  });

  // ─── Scenario 10: Role changes persist after refresh and are reflected immediately ──
  it('10. Role changes persist in DB and reflect on project member queries', async () => {
    // Update viewer to DEVELOPER
    const putRes = await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${viewerUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'DEVELOPER' });
    expect(putRes.status).toBe(200);

    // Simulating page refresh / re-querying project members
    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}/collaborators`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(200);
    const updatedViewer = getRes.body.data.find((m) => m.userId === viewerUser.id);
    expect(updatedViewer.role).toBe('DEVELOPER');

    // Revert back for consistency
    await request(app)
      .put(`/api/projects/${testProject.id}/collaborators/${viewerUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'VIEWER' });
  });

  // ─── Scenario 11: Existing features continue working ──────────────
  it('11. Existing features (member listing, file reading, activities) continue working cleanly', async () => {
    // Member list
    const membersRes = await request(app)
      .get(`/api/projects/${testProject.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(membersRes.status).toBe(200);
    expect(membersRes.body.data.length).toBe(3);

    // File reading for Editor and Viewer
    const editorFileRes = await request(app)
      .get(`/api/files/${testFile.id}`)
      .set('Authorization', `Bearer ${editorToken}`);
    expect(editorFileRes.status).toBe(200);
    expect(editorFileRes.body.data.content).toBe('console.log("hello world");');

    const viewerFileRes = await request(app)
      .get(`/api/files/${testFile.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerFileRes.status).toBe(200);
    expect(viewerFileRes.body.data.content).toBe('console.log("hello world");');

    // Activities log
    const actRes = await request(app)
      .get(`/api/projects/${testProject.id}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(actRes.status).toBe(200);
    expect(Array.isArray(actRes.body.data)).toBe(true);
  });
});
