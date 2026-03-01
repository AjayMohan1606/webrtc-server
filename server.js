// SignBridge — WebRTC Signaling Server
// Deploy this on Render as a Node.js web service
// Start command: node server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',           // Allow your GitHub Pages domain
    methods: ['GET', 'POST']
  }
});

// Track rooms: roomId -> [socketId, socketId]
const rooms = {};

app.get('/', (req, res) => {
  res.send('SignBridge Signaling Server is running ✅');
});

// Keep-alive ping endpoint (prevents Render free tier from sleeping)
app.get('/ping', (req, res) => res.send('pong'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // ── Join Room ──
  socket.on('join-room', ({ roomId, isHost }) => {
    if (!roomId) return;

    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = isHost;

    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    console.log(`[${roomId}] ${socket.id} joined (host: ${isHost}) — ${rooms[roomId].length} in room`);

    // If 2 people are now in the room, tell the HOST a peer joined
    // (host creates the offer)
    if (rooms[roomId].length === 2) {
      // Notify the host that a peer joined
      const hostSocket = rooms[roomId][0];
      io.to(hostSocket).emit('peer-joined');
      console.log(`[${roomId}] Peer joined — notified host ${hostSocket}`);
    }

    // If joining an already-active room (guest arrived after host)
    if (rooms[roomId].length > 1) {
      // Tell the new joiner that a host is already present
      socket.emit('peer-joined');
    }
  });

  // ── WebRTC Signaling ──
  socket.on('offer', ({ roomId, sdp }) => {
    // Send offer to everyone else in the room
    socket.to(roomId).emit('offer', { sdp });
    console.log(`[${roomId}] Offer relayed`);
  });

  socket.on('answer', ({ roomId, sdp }) => {
    socket.to(roomId).emit('answer', { sdp });
    console.log(`[${roomId}] Answer relayed`);
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });

  // ── Transcript sync (fallback via socket if DataChannel not open yet) ──
  socket.on('transcript-update', ({ roomId, text }) => {
    socket.to(roomId).emit('transcript-update', { text });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`[${roomId}] Room closed`);
      } else {
        // Tell remaining peer that the other left
        socket.to(roomId).emit('peer-left');
        console.log(`[${roomId}] Peer left, notified remaining`);
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SignBridge signaling server running on port ${PORT}`);
});
