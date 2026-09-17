import type { BotCommand } from "@grammyjs/types";

export const PUBLIC_BOT_COMMANDS: BotCommand[] = [
  { command: "air", description: "Cek tinggi muka air Angke Hulu" },
  { command: "ping", description: "Cek respons dan waktu proses bot" },
  { command: "version", description: "Tampilkan versi bot" },
  { command: "ver", description: "Alias untuk melihat versi bot" },
  { command: "versi", description: "Alias untuk melihat versi bot" },
  { command: "start", description: "Mulai dan lihat bantuan bot" },
  { command: "help", description: "Lihat bantuan bot" },
];
