import { expect, test } from "bun:test";
import type { WaterReading } from "../../src/domain/water/types.js";
import {
  buildAirRichMessage,
  buildHelpRichMessage,
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

test("air message memakai details collapsed dan buttons Rich Message", () => {
  const message = buildAirRichMessage(reading, "Asia/Jakarta");
  expect(message.blocks).toBeDefined();
  const blocks = message.blocks ?? [];
  const details = blocks.filter((block) => block.type === "details");
  const buttons = blocks.find((block) => block.type === "buttons");
  expect(details).toHaveLength(2);
  expect(buttons?.type).toBe("buttons");
  expect(JSON.stringify(message)).toContain("-44 cm");
  expect(JSON.stringify(message)).toContain("P.S. Angke Hulu 1");
  expect(JSON.stringify(message)).toContain("Status : Normal");
  expect(JSON.stringify(message)).toContain("callback_data");
});

test("help juga dikirim sebagai Rich Message", () => {
  const message = buildHelpRichMessage();
  expect(message.blocks?.some((block) => block.type === "heading")).toBe(true);
  expect(JSON.stringify(message)).toContain("/system");
});
