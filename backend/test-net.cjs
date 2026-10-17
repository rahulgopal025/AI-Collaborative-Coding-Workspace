const net = require("node:net");

const socket = net.connect({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  family: 4
});

socket.setTimeout(7000);

socket.on("connect", () => {
  console.log("NODE TCP CONNECTION SUCCESSFUL");
  socket.end();
});

socket.on("timeout", () => {
  console.log("NODE TCP CONNECTION TIMEOUT");
  socket.destroy();
  process.exitCode = 1;
});

socket.on("error", (err) => {
  console.log("NODE TCP CONNECTION FAILED");
  console.log("Error code:", err.code);
  console.log("Error:", err.message);
  process.exitCode = 1;
});
