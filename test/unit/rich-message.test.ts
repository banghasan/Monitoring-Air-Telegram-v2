import { expect, test } from "bun:test";
import type { WaterReading } from "../../src/domain/water/types.js";
import {
  buildAirRichMessage,
  buildHelpRichMessage,
  buildVersionRichMessage,
} from "../../src/interfaces/telegram/rich-message-builder.js";

const reading: WaterReading = {
  stationKey: "angke-hulu",
  stationName: "P.S. Angke Hulu 1",
  displayName: "P.S. Angke Hulu (Baru)",
  location: "Angke",
  latitude: -6.218026,
  longitude: 106.694077,
  observedAtRaw: "2026-09-17T15:10:00+07:00",
  observedAtIso: "2026-09-17T08:10:00.000Z",
  fetchedAt: "2026-09-17T08:10:00.000Z",
  heightRaw: -440,
  previousHeightRaw: -450,
  heightCm: -44,
  previousHeightCm: -45,
  statusRaw: "Status : Normal",
  statusNormalized: "NORMAL",
  thresholds: { siaga1Raw: 3000, siaga2Raw: 2500, siaga3Raw: 1500, siaga4Raw: 1 },
  sourceUrl: "https://poskobanjir.dsdadki.web.id/",
  rawFields: {},
};

test("air message memakai link teks, details collapsed, dan button Rich Message", () => {
  const message = buildAirRichMessage(reading, "Asia/Jakarta");
  expect(message.blocks).toBeDefined();
  const blocks = message.blocks ?? [];
  const details = blocks.filter((block) => block.type === "details");
  const buttons = blocks.find((block) => block.type === "buttons");
  expect(details).toHaveLength(1);
  expect(details[0]?.type).toBe("details");
  if (details[0]?.type === "details") {
    expect(details[0].summary).toBe("📋 Keterangan & Legenda");
    expect(
      details[0].blocks.some(
        (block) =>
          block.type === "paragraph" && JSON.stringify(block).includes("📥 Diambil aplikasi:"),
      ),
    ).toBe(true);
    const table = details[0].blocks.find((block) => block.type === "table");
    expect(table?.type).toBe("table");
    if (table?.type === "table") {
      expect(table.cells.map((row) => row.map((cell) => cell.text))).toEqual([
        ["Status", "Batas TMA"],
        ["🔴 BAHAYA", "> 300 cm"],
        ["🟡 SIAGA", "250–300 cm"],
        ["🔵 WASPADA", "150–250 cm"],
        ["🟢 Normal", "< 150 cm"],
      ]);
    }
  }
  expect(buttons?.type).toBe("buttons");
  expect(JSON.stringify(message)).toContain("-44 cm");
  expect(JSON.stringify(message)).toContain("P.S. Angke Hulu 1");
  expect(JSON.stringify(message)).toContain("Status : Normal");
  expect(JSON.stringify(message)).toContain("callback_data");
  expect(JSON.stringify(message)).toContain("    ├ 🕒");
  expect(JSON.stringify(message)).toContain("    ├ 📈 Naik · Ketinggian: -44 cm");
  expect(JSON.stringify(message)).toContain("    └ 🟢 Status : Normal");
  expect(JSON.stringify(blocks.filter((block) => block.type !== "details"))).not.toContain(
    "📥 Diambil aplikasi:",
  );
  expect(JSON.stringify(details[0])).toContain("📥 Diambil aplikasi:");
  expect(JSON.stringify(message)).not.toContain("pukul");
  expect(JSON.stringify(message)).not.toContain("🌊 📈");
  expect(JSON.stringify(message)).not.toContain("🚦");
  expect(JSON.stringify(message)).toContain("Batas TMA");
  expect(JSON.stringify(message)).toContain("Legenda: 📈 naik · 📉 turun · ➡️ tetap");
  expect(JSON.stringify(message)).toContain('"type":"url"');
  expect(JSON.stringify(message)).toContain(
    '"text":"Posko Banjir DKI Jakarta","url":"https://poskobanjir.dsdadki.web.id/"',
  );
  expect(JSON.stringify(message)).toContain(
    '"text":"P.S. Angke Hulu 1","url":"https://www.google.com/maps?q=-6.218026,106.694077"',
  );
  expect(JSON.stringify(message)).not.toContain("🗺️ Buka Peta");
  if (buttons?.type === "buttons") {
    expect(buttons.buttons).toHaveLength(1);
    expect(buttons.buttons[0]?.text).toBe("🔄 Segarkan");
  }
});

test("air message tidak membuat link peta jika koordinat tidak tersedia", () => {
  const message = buildAirRichMessage(
    { ...reading, latitude: undefined, longitude: undefined },
    "Asia/Jakarta",
  );
  const serialized = JSON.stringify(message);
  expect(serialized).toContain('"text":"📍 P.S. Angke Hulu 1"');
  expect(serialized).not.toContain("google.com/maps");
  expect(serialized).not.toContain("🗺️ Buka Peta");
});

test("help juga dikirim sebagai Rich Message", () => {
  const message = buildHelpRichMessage(reading.sourceUrl);
  expect(message.blocks?.some((block) => block.type === "heading")).toBe(true);
  const serialized = JSON.stringify(message);
  expect(serialized).toContain("/system");
  expect(serialized).toContain("/version, /ver, atau /versi");
  expect(serialized).toContain("Hasanudin H Syafaat");
  expect(serialized).toContain("@hasanudinhs");
  expect(serialized).toContain("banghasan.com");
  expect(serialized).toContain("@botindonesia");
  const buttons = message.blocks?.find((block) => block.type === "buttons");
  expect(buttons?.type).toBe("buttons");
  if (buttons?.type === "buttons") {
    expect(buttons.buttons).toEqual([
      {
        text: "💬 Grup Diskusi @botindonesia",
        style: "link",
        url: "https://t.me/botindonesia",
      },
    ]);
  }
});

test("version message menampilkan versi aplikasi", () => {
  const message = buildVersionRichMessage("1.2.3");
  expect(JSON.stringify(message)).toContain("📦 VERSI BOT");
  expect(JSON.stringify(message)).toContain("🏷️ Versi aplikasi: 1.2.3");
});
