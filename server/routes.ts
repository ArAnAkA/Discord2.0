import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { storage } from "./storage";
import { api } from "@shared/routes";
import type { User } from "@shared/schema";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";

const JWT_COOKIE_NAME = "aurora_auth";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const JWT_SECRET = process.env.JWT_SECRET || "aurora-dev-secret";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

type PublicUser = Omit<User, "password">;

function toPublicUser(user: User): PublicUser {
  const { password, ...publicUser } = user;
  void password;
  return publicUser;
}

function getCookieValue(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return undefined;
}

function getTokenFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return getCookieValue(req.headers.cookie, JWT_COOKIE_NAME);
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(JWT_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// Middleware to verify JWT
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);

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

  io.use(async (socket, next) => {
    try {
      const token = getCookieValue(socket.handshake.headers.cookie, JWT_COOKIE_NAME);
      if (!token) return next(new Error("unauthorized"));

      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
      const user = await storage.getUser(decoded.id);
      if (!user) return next(new Error("unauthorized"));

      socket.data.userId = user.id;
      socket.data.user = toPublicUser(user);
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  const voiceJoinSchema = z.object({ channelId: z.coerce.number().int().positive() });
  const voiceSignalSchema = z.object({ to: z.string().min(1), data: z.unknown() });

  // Socket.IO Logic
  io.on("connection", (socket) => {
    console.log("New client connected", socket.id);

    // Register handlers first (avoid dropping early emits right after connect).
    // Join room based on manual join (used for text realtime if needed)
    socket.on("join:channel", (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on("typing:start", ({ channelId, username }) => {
      socket.to(`channel:${channelId}`).emit("typing:start", { username });
    });

    socket.on("typing:stop", ({ channelId, username }) => {
      socket.to(`channel:${channelId}`).emit("typing:stop", { username });
    });

    socket.on("voice:join", async (payload) => {
      const parsed = voiceJoinSchema.safeParse(payload);
      if (!parsed.success) return socket.emit("voice:error", { message: "Invalid channel" });

      const channelId = parsed.data.channelId;
      const channel = await storage.getChannel(channelId);
      if (!channel) return socket.emit("voice:error", { message: "Channel not found" });
      if (channel.type !== "voice") return socket.emit("voice:error", { message: "Not a voice channel" });

      if (channel.serverId) {
        const isMember = await storage.isMember(channel.serverId, socket.data.userId);
        if (!isMember) return socket.emit("voice:error", { message: "Not a member" });
      }

      const prevChannelId: number | undefined = socket.data.voiceChannelId;
      if (prevChannelId && prevChannelId !== channelId) {
        socket.leave(`voice:${prevChannelId}`);
        socket.to(`voice:${prevChannelId}`).emit("voice:peer-left", { peerId: socket.id });
      }

      socket.data.voiceChannelId = channelId;
      socket.join(`voice:${channelId}`);

      const sockets = await io.in(`voice:${channelId}`).fetchSockets();
      const peers = sockets
        .filter((s) => s.id !== socket.id)
        .map((s) => ({ peerId: s.id, user: s.data.user }));

      socket.emit("voice:peers", { channelId, peers });
      socket.to(`voice:${channelId}`).emit("voice:peer-joined", { peerId: socket.id, user: socket.data.user });
    });

    socket.on("voice:leave", () => {
      const channelId: number | undefined = socket.data.voiceChannelId;
      if (!channelId) return;
      socket.data.voiceChannelId = undefined;
      socket.leave(`voice:${channelId}`);
      socket.to(`voice:${channelId}`).emit("voice:peer-left", { peerId: socket.id });
    });

    socket.on("voice:signal", (payload) => {
      const parsed = voiceSignalSchema.safeParse(payload);
      if (!parsed.success) return;
      io.to(parsed.data.to).emit("voice:signal", { from: socket.id, data: parsed.data.data });
    });

    socket.on("disconnect", async () => {
      const channelId: number | undefined = socket.data.voiceChannelId;
      if (channelId) {
        socket.to(`voice:${channelId}`).emit("voice:peer-left", { peerId: socket.id });
      }

      await storage.updateUserOnline(socket.data.userId, false);
      io.emit("presence:update", { userId: socket.data.userId, online: false });
    });

    // Presence update (async; doesn't block handler registration)
    void storage
      .updateUserOnline(socket.data.userId, true)
      .then(() => {
        io.emit("presence:update", { userId: socket.data.userId, online: true });
      })
      .catch((err) => {
        console.error("Failed to update presence:", err);
      });
  });

  // Multer setup
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  
  const storageConfig = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
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

      // Create a starter server for new users so the UI has something to show
      await storage.createServer({
        name: `${user.displayName}'s server`,
        iconUrl: user.avatarUrl,
        ownerId: user.id,
      });

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
      });

      setAuthCookie(res, token);
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
      });
      setAuthCookie(res, token);
      res.status(200).json({ token, user: toPublicUser(user) });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.logout.path, (_req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
  });

  app.get(api.auth.me.path, authenticateToken, async (req, res) => {
    const user = await storage.getUser((req as any).user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json(toPublicUser(user));
  });

  app.patch(api.users.me.update.path, authenticateToken, async (req, res) => {
    try {
      const input = api.users.me.update.input.parse(req.body);
      if (input.displayName === undefined && input.avatarUrl === undefined) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updated = await storage.updateUserProfile((req as any).user.id, input);
      res.json(toPublicUser(updated));
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
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

  app.patch(api.servers.update.path, authenticateToken, async (req, res) => {
    try {
      const serverId = parseInt(getParam(req.params.id), 10);
      const server = await storage.getServer(serverId);
      if (!server) return res.status(404).json({ message: "Server not found" });

      const member = await storage.getServerMember(serverId, (req as any).user.id);
      if (!member) return res.status(403).json({ message: "Not a member" });
      if (member.role !== "owner" && member.role !== "admin") {
        return res.status(403).json({ message: "Not allowed" });
      }

      const input = api.servers.update.input.parse(req.body);
      const updated = await storage.updateServer(serverId, { name: input.name });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.servers.get.path, authenticateToken, async (req, res) => {
    const serverId = parseInt(getParam(req.params.id), 10);
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
    const serverId = parseInt(getParam(req.params.id), 10);
    const server = await storage.getServer(serverId);
    if (!server) return res.status(404).json({ message: "Server not found" });
    const member = await storage.addServerMember(serverId, (req as any).user.id);
    res.json(member);
  });

  app.post(api.servers.invite.path, authenticateToken, async (req, res) => {
    try {
      const serverId = parseInt(getParam(req.params.id), 10);
      const server = await storage.getServer(serverId);
      if (!server) return res.status(404).json({ message: "Server not found" });

      const { username } = api.servers.invite.input.parse(req.body);

      const inviterId = (req as any).user.id as number;
      const inviterMember = await storage.getServerMember(serverId, inviterId);
      if (!inviterMember) return res.status(403).json({ message: "Not a member" });
      if (inviterMember.role !== "owner" && inviterMember.role !== "admin") {
        return res.status(403).json({ message: "Not allowed" });
      }

      const handle = username.trim().replace(/^@+/, "");
      if (!handle) return res.status(400).json({ message: "Invalid username" });

      const invited = await storage.getUserByUsername(handle);
      if (!invited) return res.status(404).json({ message: "User not found" });

      await storage.addServerMember(serverId, invited.id, "member");
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.channels.list.path, authenticateToken, async (req, res) => {
    const serverId = parseInt(getParam(req.params.serverId), 10);
    const isMember = await storage.isMember(serverId, (req as any).user.id);
    if (!isMember) return res.status(403).json({ message: "Not a member" });
    const channels = await storage.getChannels(serverId);
    res.json(channels);
  });

  app.post(api.channels.create.path, authenticateToken, async (req, res) => {
    try {
      const serverId = parseInt(getParam(req.params.serverId), 10);
      const member = await storage.getServerMember(serverId, (req as any).user.id);
      if (!member) return res.status(403).json({ message: "Not a member" });
      if (member.role !== "owner" && member.role !== "admin") {
        return res.status(403).json({ message: "Not allowed" });
      }
      const input = api.channels.create.input.parse(req.body);
      const channel = await storage.createChannel({ ...input, serverId });
      res.status(201).json(channel);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.channels.messages.path, authenticateToken, async (req, res) => {
    const channelId = parseInt(getParam(req.params.channelId), 10);
    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.serverId) {
      const isMember = await storage.isMember(channel.serverId, (req as any).user.id);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
    }
    const messages = await storage.getMessages(channelId);
    res.json(messages);
  });

  // POST Message route (optional, but good for persistence)
  // Socket.IO is usually preferred for realtime, but we can POST then emit
  app.post('/api/channels/:channelId/messages', authenticateToken, async (req, res) => {
    try {
      const channelId = parseInt(getParam(req.params.channelId), 10);
      const { content, attachmentUrl } = req.body as { content?: string; attachmentUrl?: string };

      if (!content && !attachmentUrl) {
        return res.status(400).json({ message: "Message content or attachment is required" });
      }

      const channel = await storage.getChannel(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      if (channel.serverId) {
        const isMember = await storage.isMember(channel.serverId, (req as any).user.id);
        if (!isMember) return res.status(403).json({ message: "Not a member" });
      }
      
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
      
      // Create Favorites Server (as a special server/space)
      const favoritesServer = await storage.createServer({
        name: "Избранное",
        iconUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Fav&backgroundColor=0dd6f2",
        ownerId: user.id
      });

      // Create extra channels for Aurora Hub
      const auroraChannels = ["random", "introductions", "memes"];
      for (const name of auroraChannels) {
        await storage.createChannel({ serverId: server.id, name, type: "text" });
      }

      // Create channels for Favorites
      const favChannels = ["заметки", "ссылки", "медиа"];
      for (const name of favChannels) {
        await storage.createChannel({ serverId: favoritesServer.id, name, type: "text" });
      }
      
      console.log("Seeding complete!");
    }
  } catch (err) {
    console.error("Seeding failed:", err);
  }

  return httpServer;
}
