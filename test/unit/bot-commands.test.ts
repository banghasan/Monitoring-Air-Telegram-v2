import { expect, test } from "bun:test";
import { PUBLIC_BOT_COMMANDS } from "../../src/interfaces/telegram/bot-commands.js";

test("menu Telegram menyediakan command versi dan aliasnya", () => {
  const commands = PUBLIC_BOT_COMMANDS.map((item) => item.command);
  expect(commands).toContain("version");
  expect(commands).toContain("ver");
  expect(commands).toContain("versi");
});
