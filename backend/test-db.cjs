require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log("DATABASE CONNECTION SUCCESSFUL");
  } catch (error) {
    console.error("DATABASE CONNECTION FAILED");
    console.error("Prisma error code:", error.errorCode ?? error.code ?? "N/A");
    console.error("Message:", error.message);
    console.error("Metadata:", error.meta ?? "N/A");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

testConnection();
