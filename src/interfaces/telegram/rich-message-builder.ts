import type {
  InputRichBlock as InputRichBlockDefinition,
  InputRichMessage as InputRichMessageDefinition,
  RichBlockTableCell,
  RichText,
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

function paragraph(text: RichText): InputRichBlock {
  return { type: "paragraph", text };
}

function divider(): InputRichBlock {
  return { type: "divider" };
}

function linkedText(text: string, url: string): RichText {
  return { type: "url", text, url };
}

function monospaceText(text: string): RichText {
  return { type: "code", text };
}

function sourceWebsiteUrl(sourceUrl: string): string {
  try {
    return new URL("/", sourceUrl).toString();
  } catch {
    return sourceUrl;
  }
}

function stationText(reading: WaterReading): RichText {
  const mapUrl = stationMapUrl(reading);
  if (!mapUrl) return `📍 ${reading.stationName}`;
  return ["📍 ", linkedText(reading.stationName, mapUrl)];
}

function stationMapUrl(reading: WaterReading): string | undefined {
  if (reading.latitude === undefined || reading.longitude === undefined) return undefined;
  return `https://www.google.com/maps?q=${reading.latitude},${reading.longitude}`;
}

function tableCell(text: RichText, isHeader = false): RichBlockTableCell {
  return {
    text,
    align: "left",
    valign: "middle",
    ...(isHeader ? { is_header: true as const } : {}),
  };
}

function dataBlocks(
  reading: WaterReading,
  timezone: string,
  freshness: AirMessageFreshness = {},
): InputRichBlock[] {
  const trend = trendFromReading(reading);
  return [
    paragraph(stationText(reading)),
    paragraph(["    ├ 🕒 ", monospaceText(formatObservedAt(reading, timezone))]),
    paragraph(`    ├ ${trendLabel(trend)} · Ketinggian: ${formatCm(reading.heightRaw)} cm`),
    paragraph(`    └ ${statusEmoji(reading.statusRaw)} ${reading.statusRaw}`),
    ...(freshness.kind ? [paragraph(`📦 Data: ${freshness.kind}`)] : []),
    ...(freshness.kind === "stale" || freshness.sourceFresh === false
      ? [paragraph("⚠️ Data terakhir berhasil diambil, tetapi belum dapat diperbarui.")]
      : []),
  ];
}

function detailsBlocks(reading: WaterReading, timezone: string): InputRichBlock[] {
  return [
    {
      type: "details",
      summary: "📋 Keterangan & Legenda",
      blocks: [
        paragraph([
          "📥 Diambil aplikasi: ",
          monospaceText(formatFetchedAt(reading.fetchedAt, timezone)),
        ]),
        {
          type: "table",
          is_bordered: true,
          is_compact: true,
          cells: [
            [tableCell("Status", true), tableCell("Batas TMA", true)],
            ...thresholdSummary(reading.thresholds).map((row) => [
              tableCell(row.status),
              tableCell(row.range),
            ]),
          ],
        },
        paragraph("🧭 Legenda: 📈 naik · 📉 turun · ➡️ tetap"),
      ],
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
    paragraph([
      "🌐 Sumber: ",
      linkedText("Posko Banjir DKI Jakarta", sourceWebsiteUrl(reading.sourceUrl)),
      "\n\n",
    ]),
    ...dataBlocks(reading, timezone, freshness),
    divider(),
    ...detailsBlocks(reading, timezone),
    {
      type: "buttons",
      buttons: [{ text: "🔄 Segarkan", style: "primary", callback_data: REFRESH_CALLBACK }],
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
      `📣 Perubahan status:\n    └ ${previousStatus} → ${reading.statusRaw.replace(/^status\s*:\s*/i, "")}`,
    ),
    paragraph(
      `🌊 Pembacaan saat perubahan:\n    ├ Ketinggian: ${formatCm(reading.heightRaw)} cm\n    └ Arah: ${trendLabel(trend)}`,
    ),
    divider(),
    ...detailsBlocks(reading, timezone),
  ];
  return { blocks };
}

export function buildHelpRichMessage(
  sourceUrl = "https://poskobanjir.dsdadki.web.id/xmldata.xml",
): InputRichMessage {
  return {
    blocks: [
      { type: "heading", size: 2, text: "🌊 Bot Pemantauan Air" },
      paragraph([
        "Menyediakan informasi Tinggi Muka Air (TMA) P.S. Angke Hulu dari ",
        linkedText("Posko Banjir DKI Jakarta", sourceWebsiteUrl(sourceUrl)),
        ".",
      ]),
      divider(),
      paragraph("📚 Perintah"),
      paragraph("/air — cek tinggi muka air Angke Hulu"),
      paragraph("/ping — cek respons bot dan waktu proses"),
      paragraph("/version, /ver, atau /versi — informasi versi bot"),
      paragraph("/start atau /help — tampilkan bantuan ini"),
      paragraph("🔒 /system — informasi sistem (khusus owner/admin)"),
      divider(),
      paragraph("👨‍💻 Pengembang"),
      paragraph([
        "Hasanudin H Syafaat\n",
        linkedText("@hasanudinhs", "https://t.me/hasanudinhs"),
        " · ",
        linkedText("banghasan.com", "https://banghasan.com"),
      ]),
      {
        type: "buttons",
        buttons: [
          {
            text: "💬 Grup Diskusi @botindonesia",
            style: "link",
            url: "https://t.me/botindonesia",
          },
        ],
      },
    ],
  };
}

export function buildVersionRichMessage(version: string): InputRichMessage {
  return {
    blocks: [
      { type: "heading", size: 2, text: "📦 VERSI BOT" },
      paragraph(`🏷️ Versi aplikasi: ${version}`),
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
