import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertUserSchema, insertServerSchema, insertChannelSchema } from "@shared/schema";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";

const JWT_SECRET = process.env.JWT_SECRET || "replit-aurora-secret";

// Middleware to verify JWT
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    next();
  });
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: "*" }
  });

  // Socket.IO Logic
  io.on("connection", (socket) => {
    console.log("New client connected", socket.id);

    // Join room based on authentication or manual join
    socket.on("join:channel", (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on("typing:start", ({ channelId, username }) => {
      socket.to(`channel:${channelId}`).emit("typing:start", { username });
    });

    socket.on("typing:stop", ({ channelId, username }) => {
      socket.to(`channel:${channelId}`).emit("typing:stop", { username });
    });

    socket.on("auth:identify", async ({ token }) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        await storage.updateUserOnline(decoded.id, true);
        io.emit("presence:update", { userId: decoded.id, online: true });
        (socket as any).userId = decoded.id;
      } catch (e) {
        console.error("Socket auth failed");
      }
    });

    socket.on("disconnect", async () => {
      if ((socket as any).userId) {
        await storage.updateUserOnline((socket as any).userId, false);
        io.emit("presence:update", { userId: (socket as any).userId, online: false });
      }
    });
  });

  // Multer setup
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  
  const storageConfig = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, uniqueSuffix + '-' + file.originalname)
    }
  });
  
  const upload = multer({ 
    storage: storageConfig,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  app.use("/uploads", express.static(uploadsDir));

  // --- Auth Routes ---
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({ token, user });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      res.status(200).json({ token, user });
    } catch (e) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.auth.me.path, authenticateToken, async (req, res) => {
    const user = await storage.getUser((req as any).user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json(user);
  });

  // --- Data Routes ---
  app.get(api.servers.list.path, authenticateToken, async (req, res) => {
    const servers = await storage.getUserServers((req as any).user.id);
    res.json(servers);
  });

  app.post(api.servers.create.path, authenticateToken, async (req, res) => {
    try {
      const input = api.servers.create.input.parse(req.body);
      const server = await storage.createServer({ ...input, ownerId: (req as any).user.id });
      res.status(201).json(server);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.servers.get.path, authenticateToken, async (req, res) => {
    const serverId = parseInt(req.params.id);
    const server = await storage.getServer(serverId);
    if (!server) return res.status(404).json({ message: "Server not found" });

    // Check membership
    const isMember = await storage.isMember(serverId, (req as any).user.id);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const channels = await storage.getChannels(serverId);
    const members = await storage.getServerMembers(serverId); // returns { ...member, user }
    
    // Transform members to just users for simplicity or keep member data
    const users = members.map(m => ({ ...m.user, role: m.role }));

    res.json({ ...server, channels, members: users });
  });

  app.post(api.servers.join.path, authenticateToken, async (req, res) => {
    const serverId = parseInt(req.params.id);
    const member = await storage.addServerMember(serverId, (req as any).user.id);
    res.json(member);
  });

  app.get(api.channels.list.path, authenticateToken, async (req, res) => {
    const serverId = parseInt(req.params.serverId);
    const channels = await storage.getChannels(serverId);
    res.json(channels);
  });

  app.post(api.channels.create.path, authenticateToken, async (req, res) => {
    try {
      const serverId = parseInt(req.params.serverId);
      const input = api.channels.create.input.parse(req.body);
      const channel = await storage.createChannel({ ...input, serverId });
      res.status(201).json(channel);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.channels.messages.path, authenticateToken, async (req, res) => {
    const channelId = parseInt(req.params.channelId);
    const messages = await storage.getMessages(channelId);
    res.json(messages);
  });

  // POST Message route (optional, but good for persistence)
  // Socket.IO is usually preferred for realtime, but we can POST then emit
  app.post('/api/channels/:channelId/messages', authenticateToken, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const { content, attachmentUrl } = req.body;
      
      const message = await storage.createMessage({
        channelId,
        userId: (req as any).user.id,
        content,
        attachmentUrl
      });
      
      // Emit to socket room
      io.to(`channel:${channelId}`).emit("message:new", message);
      
      res.status(201).json(message);
    } catch (e) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post(api.upload.create.path, authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    const url = `/uploads/${req.file.filename}`;
    res.json({ 
      url, 
      filename: req.file.originalname, 
      mimetype: req.file.mimetype 
    });
  });

  // SEED DATA ON STARTUP
  // Check if any servers exist, if not, create mock data
  try {
    const servers = await storage.getServers();
    if (servers.length === 0) {
      console.log("Seeding database...");
      
      // Create Demo User
      const hashed = await bcrypt.hash("password", 10);
      const user = await storage.createUser({
        username: "demo",
        password: hashed,
        displayName: "Demo User",
        avatarUrl: "https://github.com/shadcn.png"
      });
      
      // Create Aurora Hub Server
      const server = await storage.createServer({
        name: "Aurora Hub",
        iconUrl: "https://github.com/shadcn.png",
        ownerId: user.id
      });
      
      // Create extra channels
      const channels = ["random", "introductions", "memes"];
      for (const name of channels) {
        await storage.createChannel({ serverId: server.id, name, type: "text" });
      }
      
      console.log("Seeding complete!");
    }
  } catch (err) {
    console.error("Seeding failed:", err);
  }

  return httpServer;
}
