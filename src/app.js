import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from "http";
import { Server } from "socket.io";

import socketHandler from "./socket/socket.js";
import authRoutes from './routes/authRoutes.js';
import chatDashboard from './routes/chatDashboard.js';
import messageRoutes from './routes/messageRoutes.js'; // Add this

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://whats-app-frontend-git-main-harshvardhan-pipariyas-projects.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({
  origin: "https://whats-app-frontend-git-main-harshvardhan-pipariyas-projects.vercel.app",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

socketHandler(io);  

// Routes
app.get('/', (req, res) => {
  res.send('Backend Working');
});

app.use('/api/auth', authRoutes);
app.use('/api/chatDashboard', chatDashboard);
app.use('/api/messages', messageRoutes);

// Export both app and server
export { app, server, io };