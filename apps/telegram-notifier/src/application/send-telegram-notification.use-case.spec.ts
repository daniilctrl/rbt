import { Test } from '@nestjs/testing';
import type { TelegramNotification } from '@app/contracts';
import { SendTelegramNotificationUseCase } from './send-telegram-notification.use-case';
import {
  TELEGRAM_CLIENT,
  TelegramClientPort,
  TelegramPermanentError,
  TelegramTransientError,
} from './ports/telegram-client.port';

const notification: TelegramNotification = {
  notificationId: 'n-1',
  causedByEventId: 'e-1',
  correlationId: 'c-1',
  chatId: '12345',
  text: 'hello',
  parseMode: 'HTML',
};

describe('SendTelegramNotificationUseCase', () => {
  let useCase: SendTelegramNotificationUseCase;
  let client: jest.Mocked<TelegramClientPort>;

  beforeEach(async () => {
    client = { sendMessage: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SendTelegramNotificationUseCase,
        { provide: TELEGRAM_CLIENT, useValue: client },
      ],
    }).compile();
    useCase = moduleRef.get(SendTelegramNotificationUseCase);
  });

  it('передаёт chatId/text/parseMode в клиент', async () => {
    client.sendMessage.mockResolvedValue({ messageId: 99, date: Date.now() });
    await useCase.execute(notification);
    expect(client.sendMessage).toHaveBeenCalledWith({
      chatId: '12345',
      text: 'hello',
      parseMode: 'HTML',
    });
  });

  it('пробрасывает transient-ошибку (consumer пересылает в retry)', async () => {
    client.sendMessage.mockRejectedValue(new TelegramTransientError('502'));
    await expect(useCase.execute(notification)).rejects.toBeInstanceOf(TelegramTransientError);
  });

  it('пробрасывает permanent-ошибку (consumer паркует без ретрая)', async () => {
    client.sendMessage.mockRejectedValue(new TelegramPermanentError('400 chat not found', 400));
    await expect(useCase.execute(notification)).rejects.toBeInstanceOf(TelegramPermanentError);
  });
});
