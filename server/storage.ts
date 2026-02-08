import { db } from "./db";
import {
  users, servers, channels, messages, serverMembers,
  type User, type InsertUser,
  type Server, type InsertServer,
  type Channel, type InsertChannel,
  type Message, type InsertMessage,
  type ServerMember
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

type PublicUser = Omit<User, "password">;

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: number, profile: { displayName?: string; avatarUrl?: string }): Promise<User>;
  updateUserOnline(userId: number, online: boolean): Promise<void>;

  // Servers
  getServers(): Promise<Server[]>;
  getUserServers(userId: number): Promise<Server[]>;
  createServer(server: InsertServer & { ownerId: number }): Promise<Server>;
  getServer(id: number): Promise<Server | undefined>;
  updateServer(serverId: number, updates: { name?: string; iconUrl?: string }): Promise<Server>;
  
  // Members
  addServerMember(serverId: number, userId: number, role?: string): Promise<ServerMember>;
  getServerMember(serverId: number, userId: number): Promise<ServerMember | undefined>;
  getServerMembers(serverId: number): Promise<(ServerMember & { user: PublicUser })[]>;
  isMember(serverId: number, userId: number): Promise<boolean>;

  // Channels
  getChannels(serverId: number): Promise<Channel[]>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;

  // Messages
  getMessages(channelId: number): Promise<(Message & { sender: PublicUser })[]>;
  createMessage(message: InsertMessage & { userId: number }): Promise<Message & { sender: PublicUser }>;
}

export class DatabaseStorage implements IStorage {
  private async getPublicUser(id: number): Promise<PublicUser | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        online: users.online,
        lastSeen: users.lastSeen,
      })
      .from(users)
      .where(eq(users.id, id));

    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserProfile(
    userId: number,
    profile: { displayName?: string; avatarUrl?: string },
  ): Promise<User> {
    const updates: Partial<InsertUser> = {};
    if (profile.displayName !== undefined) updates.displayName = profile.displayName;
    if (profile.avatarUrl !== undefined) updates.avatarUrl = profile.avatarUrl;

    const [user] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserOnline(userId: number, online: boolean): Promise<void> {
    await db.update(users).set({ online, lastSeen: new Date() }).where(eq(users.id, userId));
  }

  async getServers(): Promise<Server[]> {
    return await db.select().from(servers);
  }

  async getUserServers(userId: number): Promise<Server[]> {
    const memberships = await db.select().from(serverMembers).where(eq(serverMembers.userId, userId));
    if (memberships.length === 0) return [];
    
    // In a real app we'd use a join, but for simplicity/Drizzle standard patterns:
    const serverIds = memberships.map(m => m.serverId);
    // Fetch servers where id is in serverIds (need 'inArray' from drizzle-orm but let's iterate for safety/simplicity in MVP)
    // Actually, let's do a join query which is better
    const result = await db.select({
      id: servers.id,
      name: servers.name,
      iconUrl: servers.iconUrl,
      ownerId: servers.ownerId,
      createdAt: servers.createdAt
    })
    .from(servers)
    .innerJoin(serverMembers, eq(servers.id, serverMembers.serverId))
    .where(eq(serverMembers.userId, userId));
    
    return result;
  }

  async createServer(server: InsertServer & { ownerId: number }): Promise<Server> {
    const [newServer] = await db.insert(servers).values(server).returning();
    // Add owner as member
    await this.addServerMember(newServer.id, server.ownerId, "owner");
    // Create default 'general' channel
    await this.createChannel({ serverId: newServer.id, name: "general", type: "text" });
    return newServer;
  }

  async getServer(id: number): Promise<Server | undefined> {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));
    return server;
  }

  async updateServer(serverId: number, updates: { name?: string; iconUrl?: string }): Promise<Server> {
    const [server] = await db.update(servers).set(updates).where(eq(servers.id, serverId)).returning();
    if (!server) throw new Error("Server not found");
    return server;
  }

  async addServerMember(serverId: number, userId: number, role: string = "member"): Promise<ServerMember> {
    const existing = await this.getServerMember(serverId, userId);
    if (existing) return existing;

    const [member] = await db.insert(serverMembers).values({ serverId, userId, role }).returning();
    return member;
  }

  async getServerMember(serverId: number, userId: number): Promise<ServerMember | undefined> {
    const [member] = await db
      .select()
      .from(serverMembers)
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId)));
    return member;
  }

  async getServerMembers(serverId: number): Promise<(ServerMember & { user: PublicUser })[]> {
    const rows = await db
      .select({
        member: serverMembers,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          online: users.online,
          lastSeen: users.lastSeen,
        },
      })
      .from(serverMembers)
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(eq(serverMembers.serverId, serverId));

    return rows.map((r) => ({ ...r.member, user: r.user }));
  }

  async isMember(serverId: number, userId: number): Promise<boolean> {
    return !!(await this.getServerMember(serverId, userId));
  }

  async getChannels(serverId: number): Promise<Channel[]> {
    return await db.select().from(channels).where(eq(channels.serverId, serverId));
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [newChannel] = await db.insert(channels).values(channel).returning();
    return newChannel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel;
  }

  async getMessages(channelId: number): Promise<(Message & { sender: PublicUser })[]> {
    const rows = await db
      .select({
        message: messages,
        sender: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          online: users.online,
          lastSeen: users.lastSeen,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(messages.createdAt);

    return rows.map((r) => ({ ...r.message, sender: r.sender }));
  }

  async createMessage(message: InsertMessage & { userId: number }): Promise<Message & { sender: PublicUser }> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    const sender = await this.getPublicUser(message.userId);
    if (!sender) throw new Error("User not found");
    return { ...newMessage, sender };
  }
}

export const storage = new DatabaseStorage();
