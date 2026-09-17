import type {
  InputRichBlock as InputRichBlockDefinition,
  InputRichMessage as InputRichMessageDefinition,
} from "@grammyjs/types";
import type { WaterReading } from "../../domain/water/types.js";
import {
  formatCm,
  formatFetchedAt,
  formatObservedAt,
  statusEmoji,
  thresholdSummary,
  trendFromReading,
  trendLabel,
} from "../../domain/water/water-policy.js";

type InputRichBlock = InputRichBlockDefinition<never>;
type InputRichMessage = InputRichMessageDefinition<never>;

export const REFRESH_CALLBACK = "air:refresh";

export interface AirMessageFreshness {
  kind?: "fresh" | "cache" | "stale";
  sourceFresh?: boolean;
}

function paragraph(text: string): InputRichBlock {
  return { type: "paragraph", text };
}

function divider(): InputRichBlock {
  return { type: "divider" };
}

function stationLink(reading: WaterReading): string {
  if (reading.latitude === undefined || reading.longitude === undefined) return reading.stationName;
  return `${reading.stationName}\nhttps://www.google.com/maps?q=${reading.latitude},${reading.longitude}`;
}

function dataBlocks(
  reading: WaterReading,
  timezone: string,
  freshness: AirMessageFreshness = {},
): InputRichBlock[] {
  const trend = trendFromReading(reading);
  return [
    paragraph(`📍 ${stationLink(reading)}`),
    paragraph(`  ├ 🕒 ${formatObservedAt(reading, timezone)}`),
    paragraph(`  ├ 📥 Diambil aplikasi: ${formatFetchedAt(reading.fetchedAt, timezone)}`),
    paragraph(`  ├ 🌊 ${trendLabel(trend)} · Ketinggian: ${formatCm(reading.heightRaw)} cm`),
    paragraph(`  └ 🚦 ${statusEmoji(reading.statusRaw)} ${reading.statusRaw}`),
    ...(freshness.kind ? [paragraph(`📦 Data: ${freshness.kind}`)] : []),
    ...(freshness.kind === "stale" || freshness.sourceFresh === false
      ? [paragraph("⚠️ Data terakhir berhasil diambil, tetapi belum dapat diperbarui.")]
      : []),
  ];
}

function detailsBlocks(reading: WaterReading): InputRichBlock[] {
  return [
    {
      type: "details",
      summary: "📋 Keterangan",
      blocks: thresholdSummary(reading.thresholds).map(paragraph),
    },
    {
      type: "details",
      summary: "🧭 Legenda",
      blocks: [paragraph("📈 naik"), paragraph("📉 turun"), paragraph("➡️ tetap")],
    },
  ];
}

export function buildAirRichMessage(
  reading: WaterReading,
  timezone: string,
  freshness: AirMessageFreshness = {},
): InputRichMessage {
  const blocks: InputRichBlock[] = [
    { type: "heading", size: 2, text: "🌊 PEMANTAUAN TINGGI MUKA AIR (TMA)" },
    paragraph(`🌐 Sumber: Posko Banjir DKI Jakarta\n${reading.sourceUrl}`),
    ...dataBlocks(reading, timezone, freshness),
    divider(),
    ...detailsBlocks(reading),
    {
      type: "buttons",
      buttons: [
        { text: "🔄 Segarkan", style: "primary", callback_data: REFRESH_CALLBACK },
        ...(reading.latitude === undefined || reading.longitude === undefined
          ? []
          : [
              {
                text: "🗺️ Buka Peta",
                style: "link" as const,
                url: `https://www.google.com/maps?q=${reading.latitude},${reading.longitude}`,
              },
            ]),
      ],
    },
  ];
  return { blocks };
}

export function buildAirNotificationRichMessage(
  reading: WaterReading,
  previousStatus: string,
  timezone: string,
): InputRichMessage {
  const trend = trendFromReading(reading);
  const blocks: InputRichBlock[] = [
    { type: "heading", size: 2, text: "🔔 PEMBARUAN TINGGI MUKA AIR" },
    ...dataBlocks(reading, timezone),
    paragraph(
      `📣 Perubahan status:\n  └ ${previousStatus} → ${reading.statusRaw.replace(/^status\s*:\s*/i, "")}`,
    ),
    paragraph(
      `🌊 Pembacaan saat perubahan:\n  ├ Ketinggian: ${formatCm(reading.heightRaw)} cm\n  └ Arah: ${trendLabel(trend)}`,
    ),
    divider(),
    ...detailsBlocks(reading),
  ];
  return { blocks };
}

export function buildHelpRichMessage(): InputRichMessage {
  return {
    blocks: [
      { type: "heading", size: 2, text: "🌊 Bot Pemantauan Air" },
      paragraph("Pemantauan tinggi muka air Angke Hulu dari Posko Banjir DKI Jakarta."),
      divider(),
      paragraph("/air — cek tinggi muka air Angke Hulu"),
      paragraph("/ping — cek respons bot dan waktu proses"),
      paragraph("/start atau /help — tampilkan bantuan ini"),
      paragraph("🔐 /system — informasi sistem (khusus owner/admin)"),
    ],
  };
}

export function buildPingRichMessage(milliseconds: number): InputRichMessage {
  const seconds = milliseconds / 1000;
  return {
    blocks: [
      { type: "heading", size: 2, text: "🏓 PONG" },
      paragraph(
        `└ ⏱️ Waktu proses bot: ${milliseconds.toFixed(2)} ms (${seconds.toFixed(4)} detik)`,
      ),
    ],
  };
}

export function buildSystemRichMessage(lines: string[]): InputRichMessage {
  return {
    blocks: [{ type: "heading", size: 2, text: "⚙️ INFORMASI SISTEM" }, ...lines.map(paragraph)],
  };
}

export function buildErrorRichMessage(title: string, detail: string): InputRichMessage {
  return {
    blocks: [{ type: "heading", size: 2, text: `⚠️ ${title}` }, paragraph(detail)],
  };
}
