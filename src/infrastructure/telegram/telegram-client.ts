import type { InputRichMessage as InputRichMessageDefinition } from "@grammyjs/types";
import { Bot } from "grammy";
import type { NotificationTarget, TelegramChatId } from "../../config/config.js";

type InputRichMessage = InputRichMessageDefinition<never>;

export interface TelegramMessageLocation {
  chatId: TelegramChatId;
  messageId: number;
}

export interface TelegramRichClientOptions {
  bot?: Bot;
}

export class TelegramRichClient {
  readonly bot: Bot;

  constructor(token: string, options: TelegramRichClientOptions = {}) {
    this.bot = options.bot ?? new Bot(token);
  }

  async send(target: NotificationTarget, message: InputRichMessage): Promise<void> {
    await this.bot.api.sendRichMessage(target.chatId, message, {
      message_thread_id: target.threadId,
    });
  }

  async sendToChat(
    chatId: TelegramChatId,
    message: InputRichMessage,
    threadId?: number,
  ): Promise<unknown> {
    return this.bot.api.sendRichMessage(
      chatId,
      message,
      threadId === undefined ? {} : { message_thread_id: threadId },
    );
  }

  async edit(location: TelegramMessageLocation, message: InputRichMessage): Promise<void> {
    await this.bot.api.editMessageText(location.chatId, location.messageId, message);
  }

  async answerCallback(callbackQueryId: string, text?: string): Promise<void> {
    await this.bot.api.answerCallbackQuery(callbackQueryId, text ? { text } : undefined);
  }
}
