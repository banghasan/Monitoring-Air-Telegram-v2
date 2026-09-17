import type { AppConfig, NotificationTarget } from "../../config/config.js";
import type { NotificationEvent, NotificationSender } from "../../domain/monitoring/types.js";
import type { TelegramRichClient } from "../../infrastructure/telegram/telegram-client.js";
import { buildAirNotificationRichMessage } from "../../interfaces/telegram/rich-message-builder.js";

export class TelegramNotificationSender implements NotificationSender {
  constructor(
    private readonly client: TelegramRichClient,
    private readonly config: AppConfig,
  ) {}

  async send(target: NotificationTarget, event: NotificationEvent): Promise<void> {
    await this.client.send(
      target,
      buildAirNotificationRichMessage(
        event.reading,
        event.previousStatusRaw,
        this.config.app.timezone,
      ),
    );
  }
}
