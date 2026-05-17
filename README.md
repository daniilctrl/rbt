# Nest.js + RabbitMQ + Telegram

Пет-проект: микросервисная архитектура из трёх Nest.js-сервисов, общающихся через RabbitMQ, с уведомлениями в Telegram.

- **producer** — HTTP API, принимает события, публикует в RabbitMQ с publisher confirms и ретраями
- **consumer** — обрабатывает события, обеспечивает идемпотентность через Redis, маршрутизирует уведомления
- **telegram-notifier** — отправляет уведомления через Telegram Bot API

---

## Архитектура

```
   HTTP POST /events
          │
          ▼
    ┌──────────┐  publish    ┌────────────────────┐  manual    ┌──────────┐
    │ producer │ ──────────► │  events.exchange   │ ─────────► │ consumer │
    │  :3000   │  + confirms │  (topic, durable)  │   ack      │  :3001   │
    └──────────┘             └────────────────────┘            └────┬─────┘
                                                                    │ publish
                                                                    ▼
                                                  ┌─────────────────────────┐
                                                  │ notifications.exchange  │
                                                  └────────────┬────────────┘
                                                               │
                                                               ▼
                                                       ┌────────────────┐
                                                       │ telegram-      │  HTTPS
                                                       │ notifier :3002 │ ──► Telegram Bot API
                                                       └────────────────┘
```

Для каждой рабочей очереди — отдельная retry-queue с TTL и parking DLQ.

---

## Стек

- Node.js 20, TypeScript, **Nest.js 10** (модульная архитектура, DI, чистая архитектура: domain → application → infrastructure)
- **RabbitMQ** через `@golevelup/nestjs-rabbitmq` (publisher confirms, manual ack, topic exchanges, DLX)
- **Redis** для идемпотентности (`SET NX EX` на `eventId`)
- **Telegram Bot API** через `@nestjs/axios`
- **Swagger** на producer (`/api`)
- **Jest** — unit-тесты на use-case'ы
- **Testcontainers** — e2e с настоящим RabbitMQ
- `nestjs-pino` — структурированное логирование с `correlationId` сквозь все сервисы
- pnpm workspaces — монорепозиторий с общим пакетом `@app/contracts` (типы событий)
- Docker + docker-compose, multi-stage Dockerfile

---

## Запуск

### Предварительно

1. Установлен **Docker** (Docker Desktop / Linux Docker).
2. Создан **Telegram-бот**:
   - В Telegram открыть `@BotFather` → `/newbot` → следовать инструкциям → сохранить токен.
   - Написать боту `/start` (без этого бот не сможет первым написать в чат).
   - Узнать `chat_id`: открыть в браузере `https://api.telegram.org/bot<TOKEN>/getUpdates` после отправки боту `/start` — в ответе будет `"chat":{"id":...}`.

### Шаги

```bash
# 1. Скопировать .env.example в .env и заполнить переменные
cp .env.example .env
# в .env проставить:
#   TELEGRAM_BOT_TOKEN=<токен от BotFather>
#   TELEGRAM_DEFAULT_CHAT_ID=<chat_id из getUpdates>

# 2. Поднять весь стек
docker compose up --build
```

После старта будут доступны:

| Сервис | URL | Что там |
|---|---|---|
| producer | http://localhost:3000 | HTTP API |
| Swagger | http://localhost:3000/api | Документация и UI для запросов |
| consumer | http://localhost:3001/health | Healthcheck |
| telegram-notifier | http://localhost:3002/health | Healthcheck |
| RabbitMQ Management | http://localhost:15672 | UI (логин/пароль `guest`/`guest`) |

---

## API

`POST /events` — опубликовать событие.

```json
{
  "eventType": "user.registered",
  "payload": { ... },
  "correlationId": "uuid",
  "routingKey": "event.created"
}
```

| Поле | Обяз. | Описание |
|---|---|---|
| `eventType` | да | Тип события, произвольная dot-нотация |
| `payload` | да | Произвольный JSON. Для интеграции с Telegram-сервисом можно положить `chatId`, `message`, `parseMode` |
| `correlationId` | нет | Если не передан — Producer сгенерирует UUID v4 |
| `routingKey` | нет | По умолчанию `event.created` |

Полная спецификация со схемами — в Swagger UI.

---

## Тесты

```bash
pnpm install

# Unit-тесты (быстрые, без брокера)
pnpm test

# E2E-тесты — поднимают RabbitMQ через Testcontainers
pnpm test:e2e
```

**Покрытие:**
- Unit на каждый use-case (producer / consumer / telegram-notifier) с моками портов
- E2E «producer → consumer → notifications.exchange» через настоящий RabbitMQ (Testcontainers)
- E2E «notifications.exchange → telegram-notifier → Bot API» с моком Bot API через `nock`

---

## Структура проекта

```
nest-rabbit-telegram/
├── apps/
│   ├── producer/             HTTP-вход + Swagger, публикация в events.exchange
│   ├── consumer/             Обработка, идемпотентность через Redis, retry/DLQ
│   └── telegram-notifier/    Подписка на notifications.telegram.q, отправка в Bot API
├── packages/
│   └── contracts/            Общие типы DomainEvent / TelegramNotification / routing keys
├── Dockerfile                Один Dockerfile с тремя target'ами
├── docker-compose.yml
├── .env.example
└── pnpm-workspace.yaml
```

Каждый сервис изнутри:

```
src/
├── domain/                   Чистая бизнес-логика без зависимостей
├── application/
│   ├── ports/                Интерфейсы (EventPublisherPort, IdempotencyStorePort, ...)
│   └── *.use-case.ts         Use-case'ы — зависят только от портов
└── infrastructure/
    ├── rabbit/               Адаптеры RabbitMQ
    ├── redis/                Адаптер Redis (только в consumer'е)
    ├── telegram/             HTTP-клиент Telegram (только в notifier'е)
    └── http/                 HTTP-контроллеры (только в producer'е)
```
