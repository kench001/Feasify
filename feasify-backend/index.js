const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);

// Initialize Socket.io with a wildcard origin for maximum compatibility during development
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  // LOG: See immediately when a user hits your site
  console.log(`👤 User Connected: ${socket.id}`);

  socket.on("join_group", (groupId) => {
    if (groupId) {
      socket.join(groupId);
      console.log(`🏠 Socket ${socket.id} joined group: ${groupId}`);
    }
  });

  // OPTIMIZED SEND_MESSAGE
  socket.on("send_message", (data) => {
    try {
      // 1. Validation: Stop the function if data is broken
      if (!data || !data.groupId) {
        console.error("⚠️ Rejected message: Missing groupId", data);
        return;
      }

      // 2. Logging: This lets you monitor the chat from your Render dashboard
      console.log(
        `📩 Message from [${data.senderName}] in group [${data.groupId}]: ${data.content}`,
      );

      // 3. Robust Emission: Using io.to ensures it reaches everyone in the room
      // and acts as a server confirmation.
      io.to(data.groupId).emit("receive_message", data);
    } catch (error) {
      // 4. Safety: Prevent a single bad message from crashing the backend
      console.error("❌ Backend socket error:", error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 User Disconnected (${socket.id}): ${reason}`);
  });
});

// Render dynamic port handling
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Feasify-Backend live on port ${PORT}`);
});
