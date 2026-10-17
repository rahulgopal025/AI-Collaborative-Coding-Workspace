const net = require("node:net");
const tls = require("node:tls");
const fs = require("node:fs");
const path = require("node:path");

const host = "aws-0-ap-south-1.pooler.supabase.com";
const port = 5432;

// Supabase madhun download kelela certificate ya path var thev.
const certPath = path.join(
  __dirname,
  "prisma",
  "supabase-root.crt"
);

function testPostgresSSL() {
  // Certificate file available aahe ka te check kara.
  if (!fs.existsSync(certPath)) {
    console.error("CERTIFICATE FILE NOT FOUND");
    console.error("Expected path:", certPath);
    console.error(
      "Supabase madhun certificate download karun ya path var save kara."
    );
    process.exitCode = 1;
    return;
  }

  let socket;
  let secureSocket;
  let finished = false;

  function finish(message, success = false) {
    if (finished) return;

    finished = true;

    if (message) {
      console.log(message);
    }

    if (!success) {
      process.exitCode = 1;
    }

    if (secureSocket && !secureSocket.destroyed) {
      secureSocket.destroy();
    } else if (socket && !socket.destroyed) {
      socket.destroy();
    }
  }

  let caCertificate;

  try {
    caCertificate = fs.readFileSync(certPath);
  } catch (error) {
    console.error("CERTIFICATE READ FAILED");
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log("Connecting to Supabase...");
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log("Certificate:", certPath);

  // Step 1: TCP connection test.
  socket = net.connect({
    host,
    port,
    family: 4
  });

  socket.setTimeout(10000);

  socket.on("connect", () => {
    console.log("TCP CONNECTION SUCCESSFUL");

    // PostgreSQL SSLRequest:
    // Length = 8 bytes
    // SSLRequest code = 80877103
    const sslRequest = Buffer.from([
      0x00, 0x00, 0x00, 0x08,
      0x04, 0xd2, 0x16, 0x2f
    ]);

    socket.write(sslRequest);
  });

  // Step 2: PostgreSQL server cha SSL response check kara.
  socket.once("data", (data) => {
    if (data.toString() !== "S") {
      finish(
        `POSTGRESQL SSL REQUEST REJECTED: ${data.toString()}`
      );
      return;
    }

    console.log("POSTGRESQL SSL REQUEST ACCEPTED");

    // Step 3: Download kelela certificate vaprun TLS handshake.
    secureSocket = tls.connect({
      socket,
      servername: host,
      ca: caCertificate,
      rejectUnauthorized: true
    });

    secureSocket.setTimeout(10000);

    secureSocket.once("secureConnect", () => {
      console.log("TLS HANDSHAKE SUCCESSFUL");
      console.log("Certificate verification successful.");

      // Ha test fakt network + TLS check karto.
      // Database login ya test madhye hot nahi.
      finish("SSL TEST PASSED", true);
    });

    secureSocket.on("error", (error) => {
      finish("TLS HANDSHAKE FAILED");

      console.error("Error code:", error.code || "N/A");
      console.error("Error message:", error.message);
    });

    secureSocket.on("timeout", () => {
      finish("TLS HANDSHAKE TIMEOUT");
    });
  });

  socket.on("timeout", () => {
    finish("TCP CONNECTION TIMEOUT");
  });

  socket.on("error", (error) => {
    finish("TCP CONNECTION FAILED");

    console.error("Error code:", error.code || "N/A");
    console.error("Error message:", error.message);
  });
}

testPostgresSSL();