const express = require("express");
const { PeerServer } = require("peer");

const app = express();

const server = app.listen(process.env.PORT || 3000);

PeerServer({
  port: process.env.PORT || 3000,
  path: "/peerjs"
});
