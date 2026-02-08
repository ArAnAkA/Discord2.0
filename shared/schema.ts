import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  online: boolean("online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  avatarUrl: true,
});

// Servers (Workspaces)
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  ownerId: integer("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServerSchema = createInsertSchema(servers).pick({
  name: true,
  iconUrl: true,
});

// Server Members
export const serverMembers = pgTable("server_members", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").default("member"), // 'owner', 'admin', 'member'
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Channels
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id"), // Null for DMs
  name: text("name").notNull(),
  type: text("type").default("text"), // 'text', 'voice', 'dm'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channels).pick({
  serverId: true,
  name: true,
  type: true,
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  channelId: true,
  content: true,
  attachmentUrl: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertServer = z.infer<typeof insertServerSchema>;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Server = typeof servers.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ServerMember = typeof serverMembers.$inferSelect;

// Extended types for responses
export type MessageWithUser = Message & { sender: User };
