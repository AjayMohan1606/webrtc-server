const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", socket => {

  socket.on("join-room", roomId => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined");
  });

  socket.on("offer", data => {
    socket.to(data.roomId).emit("offer", data);
  });

  socket.on("answer", data => {
    socket.to(data.roomId).emit("answer", data);
  });

  socket.on("ice-candidate", data => {
    socket.to(data.roomId).emit("ice-candidate", data);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running"));
