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

## Проверка

### Через Swagger (рекомендуется)

1. Открыть http://localhost:3000/api
2. Раскрыть `POST /events` → **Try it out**
3. Вставить тело:
   ```json
   {
     "eventType": "user.registered",
     "payload": {
       "message": "Привет из микросервиса",
       "parseMode": "HTML"
     }
   }
   ```
4. **Execute** → ответ 202 с `eventId` → в Telegram придёт сообщение от бота.

### Через curl

```bash
curl -X POST http://localhost:3000/events \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"user.registered","payload":{"message":"Привет","parseMode":"HTML"}}'
```

Ответ:
```json
{
  "eventId": "0d9a3a46-beaf-4f08-b374-ddff1e152186",
  "correlationId": "e084b334-58a4-47cc-92bc-22a1c63239f4",
  "occurredAt": "2026-05-02T20:45:52.020Z"
}
```

В логах compose видно полный путь события через все три сервиса по `eventId` / `correlationId`.

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
| `payload` | да | Произвольный JSON. Для интеграции с Telegram-сервисом можно положить `chatId`, `message`, `parseMode` (см. Swagger) |
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

## Соответствие требованиям задания

| Требование | Где реализовано |
|---|---|
| **Producer и Consumer для RabbitMQ** | `apps/producer`, `apps/consumer` |
| Уникальный идентификатор события (UUID для идемпотентности) | UUID v4 генерируется в `PublishEventUseCase`, проверяется в Redis (`SET NX EX`) в `RedisIdempotencyStoreAdapter` |
| Сериализация в JSON | Через `@golevelup/nestjs-rabbitmq` (стандартная) |
| Подтверждение успешной отправки | Publisher confirms — `RabbitEventPublisherAdapter` ждёт ack от брокера перед резолвом |
| Ретраи на временные ошибки соединения | `p-retry` с экспоненциальным backoff в Producer'е (3 попытки) |
| Автоматическое/ручное подтверждение обработки | Manual ack через `@RabbitSubscribe` в Consumer'е |
| Механизм повторной обработки при ошибке | `events.retry.q` с `x-message-ttl=2000` и dead-letter обратно в `events.exchange`. После 3 попыток — `events.dlq.parking` для ручного разбора |
| Логирование успехов/ошибок | `nestjs-pino` со структурированными JSON-логами, `correlationId` пронизывает все три сервиса |
| **Сервис отправки в Telegram** | `apps/telegram-notifier` — подписан на `notifications.telegram.q`, вызывает Bot API |
| **Nest.js модульная архитектура** | Каждый сервис разбит на `domain` / `application` (use-case'ы и порты) / `infrastructure` (адаптеры) |
| **Docker** | Multi-stage `Dockerfile` с тремя `target`, `docker-compose.yml` с healthcheck'ами |
| **SOLID, чистая архитектура** | Use-case зависит от порта (интерфейса), не от реализации. Замена RabbitMQ на Kafka = новый адаптер без изменений в use-case'е |
| **Swagger** *(в плюс)* | Producer на `/api`, DTO с `class-validator` + `@ApiProperty` |
| **Тесты Jest / e2e** *(в плюс)* | Unit на use-case'ы + e2e через Testcontainers с настоящим RabbitMQ и mock'ом Bot API |

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

---

## RabbitMQ топология

| Объект | Тип | Назначение |
|---|---|---|
| `events.exchange` | topic | Точка входа от Producer'а |
| `events.q` | queue | Основная очередь Consumer'а |
| `events.retry.q` | queue (TTL=2с, DLX) | Отлёживание перед повторной попыткой |
| `events.dlq.parking` | queue | Парковка после исчерпания ретраев |
| `notifications.exchange` | topic | Выход от Consumer'а |
| `notifications.telegram.q` | queue | Очередь Telegram-сервиса |
| `notifications.retry.q` | queue (TTL=2с, DLX) | Retry для уведомлений |
| `notifications.dlq.parking` | queue | Парковка не отправленных уведомлений |

Topology объявляется декларативно при старте сервисов через `@golevelup/nestjs-rabbitmq` — независимо от порядка запуска.
