/**
 * Database seed script.
 * Creates demo users, a sample project, members, files, folders, messages, and activities.
 * Run with: npx prisma db seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data (order matters due to foreign keys)
  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.message.deleteMany();
  await prisma.file.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  const hashedPassword = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: hashedPassword,
      avatarUrl: null,
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      password: hashedPassword,
      avatarUrl: null,
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Wilson',
      email: 'charlie@example.com',
      password: hashedPassword,
      avatarUrl: null,
    },
  });

  console.log('Created 3 demo users');

  // Create a demo project
  const project = await prisma.project.create({
    data: {
      name: 'Demo Collaborative Project',
      description: 'A sample project for demonstrating collaborative coding features.',
    },
  });

  console.log('Created demo project');

  // Add members
  await prisma.projectMember.createMany({
    data: [
      { userId: alice.id, projectId: project.id, role: 'OWNER' },
      { userId: bob.id, projectId: project.id, role: 'DEVELOPER' },
      { userId: charlie.id, projectId: project.id, role: 'VIEWER' },
    ],
  });

  console.log('Added project members');

  // Create folder structure
  const srcFolder = await prisma.folder.create({
    data: {
      name: 'src',
      projectId: project.id,
    },
  });

  const componentsFolder = await prisma.folder.create({
    data: {
      name: 'components',
      projectId: project.id,
      parentId: srcFolder.id,
    },
  });

  console.log('Created folder structure');

  // Create files
  await prisma.file.createMany({
    data: [
      {
        name: 'index.js',
        content: '// Entry point\nconsole.log("Hello, world!");',
        language: 'javascript',
        projectId: project.id,
        folderId: srcFolder.id,
      },
      {
        name: 'App.js',
        content: '// Main App component\nfunction App() {\n  return "Hello";\n}\n\nmodule.exports = App;',
        language: 'javascript',
        projectId: project.id,
        folderId: componentsFolder.id,
      },
      {
        name: 'README.md',
        content: '# Demo Project\n\nThis is a demo collaborative project.',
        language: 'markdown',
        projectId: project.id,
        folderId: null, // Root-level file
      },
    ],
  });

  console.log('Created sample files');

  // Create sample messages
  await prisma.message.createMany({
    data: [
      {
        content: 'Hey team, I just set up the project!',
        userId: alice.id,
        projectId: project.id,
      },
      {
        content: 'Great! I will start working on the components.',
        userId: bob.id,
        projectId: project.id,
      },
      {
        content: 'Looking good so far!',
        userId: charlie.id,
        projectId: project.id,
      },
    ],
  });

  console.log('Created sample messages');

  // Create sample activities
  await prisma.activity.createMany({
    data: [
      {
        action: 'PROJECT_CREATED',
        userId: alice.id,
        projectId: project.id,
        metadata: { projectName: project.name },
      },
      {
        action: 'MEMBER_ADDED',
        userId: alice.id,
        projectId: project.id,
        metadata: { addedUser: bob.name, role: 'DEVELOPER' },
      },
      {
        action: 'MEMBER_ADDED',
        userId: alice.id,
        projectId: project.id,
        metadata: { addedUser: charlie.name, role: 'VIEWER' },
      },
      {
        action: 'FILE_CREATED',
        userId: alice.id,
        projectId: project.id,
        metadata: { fileName: 'index.js' },
      },
      {
        action: 'FILE_CREATED',
        userId: bob.id,
        projectId: project.id,
        metadata: { fileName: 'App.js' },
      },
    ],
  });

  console.log('Created sample activities');

  // Create sample notifications
  await prisma.notification.createMany({
    data: [
      {
        type: 'MEMBER_ADDED',
        message: 'You have been added to "Demo Collaborative Project" as a Developer.',
        userId: bob.id,
        projectId: project.id,
      },
      {
        type: 'MEMBER_ADDED',
        message: 'You have been added to "Demo Collaborative Project" as a Viewer.',
        userId: charlie.id,
        projectId: project.id,
      },
    ],
  });

  console.log('Created sample notifications');
  console.log('Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
