import { z } from 'zod';
import { insertUserSchema, insertServerSchema, insertChannelSchema, insertMessageSchema, users, servers, channels, messages, serverMembers } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  servers: {
    list: {
      method: 'GET' as const,
      path: '/api/servers' as const,
      responses: {
        200: z.array(z.custom<typeof servers.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/servers' as const,
      input: insertServerSchema,
      responses: {
        201: z.custom<typeof servers.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/servers/:id' as const,
      responses: {
        200: z.custom<typeof servers.$inferSelect & { channels: typeof channels.$inferSelect[], members: typeof users.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/servers/:id/join' as const,
      responses: {
        200: z.custom<typeof serverMembers.$inferSelect>(),
      }
    }
  },
  channels: {
    list: {
      method: 'GET' as const,
      path: '/api/servers/:serverId/channels' as const,
      responses: {
        200: z.array(z.custom<typeof channels.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/servers/:serverId/channels' as const,
      input: insertChannelSchema.omit({ serverId: true }),
      responses: {
        201: z.custom<typeof channels.$inferSelect>(),
      },
    },
    messages: {
      method: 'GET' as const,
      path: '/api/channels/:channelId/messages' as const,
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect & { sender: typeof users.$inferSelect }>()),
      },
    },
  },
  upload: {
    create: {
      method: 'POST' as const,
      path: '/api/upload' as const,
      // Input is FormData
      responses: {
        200: z.object({ url: z.string(), filename: z.string(), mimetype: z.string() }),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
