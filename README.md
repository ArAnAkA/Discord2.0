# Aurora (Discord 2.0)

Полноценный TypeScript full‑stack проект: Express + React (Vite) + PostgreSQL (Drizzle) + чат + загрузка файлов + voice (WebRTC).

## Требования

- Node.js 20+
- PostgreSQL 14+ (рекомендуется 16)

## Настройка

1) Установить зависимости:

```bash
npm install
```

2) Создать файл `.env` (можно взять за основу `.env.example`):

```env
DATABASE_URL=postgresql://aurora_user:Str123@localhost:5432/aurora
JWT_SECRET=change-me-to-a-long-random-string
PORT=5000
```

### PostgreSQL (если база ещё не создана)

В `psql` под пользователем `postgres`:

```sql
CREATE DATABASE aurora;
CREATE USER aurora_user WITH PASSWORD 'Str123';
GRANT ALL PRIVILEGES ON DATABASE aurora TO aurora_user;
```

Если при `npm run db:push` появляется ошибка `нет доступа к схеме public`, подключись к базе `aurora` и выдай права:

```sql
\\c aurora
GRANT USAGE, CREATE ON SCHEMA public TO aurora_user;
```

3) Создать/обновить таблицы в базе:

```bash
npm run db:push
```

4) Запуск в режиме разработки:

```bash
npm run dev
```

Открыть в браузере: `http://localhost:5000`

## Продакшн сборка

```bash
npm run build
npm start
```

## Файлы

- Загруженные файлы сохраняются в `uploads/` и доступны по пути `/uploads/...`.
