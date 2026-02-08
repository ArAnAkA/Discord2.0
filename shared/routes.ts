import { z } from 'zod';
import { insertUserSchema, insertServerSchema, insertChannelSchema, insertMessageSchema, users, servers, channels, messages, serverMembers } from './schema';

type PublicUser = Omit<typeof users.$inferSelect, "password">;

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
        201: z.object({ token: z.string(), user: z.custom<PublicUser>() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.object({ token: z.string(), user: z.custom<PublicUser>() }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        204: z.undefined(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<PublicUser>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    me: {
      update: {
        method: 'PATCH' as const,
        path: '/api/users/me' as const,
        input: z.object({
          displayName: z.string().min(1).optional(),
          avatarUrl: z.string().min(1).optional(),
        }),
        responses: {
          200: z.custom<PublicUser>(),
          400: errorSchemas.validation,
          401: errorSchemas.unauthorized,
        },
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
        200: z.custom<typeof servers.$inferSelect & { channels: typeof channels.$inferSelect[], members: PublicUser[] }>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/servers/:id' as const,
      input: z.object({ name: z.string().min(1) }),
      responses: {
        200: z.custom<typeof servers.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/servers/:id/join' as const,
      responses: {
        200: z.custom<typeof serverMembers.$inferSelect>(),
      }
    },
    invite: {
      method: 'POST' as const,
      path: '/api/servers/:id/invite' as const,
      input: z.object({ username: z.string().min(1) }),
      responses: {
        200: z.object({ ok: z.literal(true) }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
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
        200: z.array(z.custom<typeof messages.$inferSelect & { sender: PublicUser }>()),
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
