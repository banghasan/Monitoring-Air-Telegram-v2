import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { trendFromReading } from "../../src/domain/water/water-policy.js";
import {
  parseAngkeHuluXml,
  StationAmbiguousError,
  StationNotFoundError,
} from "../../src/infrastructure/source/xml-water-source.js";

const fixture = await readFile(new URL("../fixtures/angke-hulu.xml", import.meta.url), "utf8");

test("memilih record Angke Hulu secara semantik dan tidak mengunci ID/kode", () => {
  const reading = parseAngkeHuluXml(fixture, {
    stationQuery: "  angke   hulu ",
    stationDisplayName: "P.S. Angke Hulu (Baru)",
    sourceUrl: "https://example.test/xmldata.xml",
  });

  expect(reading.stationKey).toBe("angke-hulu");
  expect(reading.stationName).toBe("P.S. Angke Hulu 1");
  expect(reading.sourceId).toBe("999");
  expect(reading.stationCode).toBe("99");
  expect(reading.heightRaw).toBe(-440);
  expect(reading.heightCm).toBe(-44);
  expect(reading.statusNormalized).toBe("NORMAL");
  expect(reading.thresholds.siaga1Raw).toBe(3000);
  expect(reading.latitude).toBe(-6.218026);
});

test("selector menolak nol hasil dan lebih dari satu hasil", () => {
  expect(() =>
    parseAngkeHuluXml(fixture, {
      stationQuery: "tidak ada",
      stationDisplayName: "Angke",
      sourceUrl: "https://example.test",
    }),
  ).toThrow(StationNotFoundError);

  const duplicate = fixture.replace(
    "</DocumentElement>",
    `<SP_GET_LAST_STATUS_PINTU_AIR>
      <NAMA_PINTU_AIR>P.S. Angke Hulu 2</NAMA_PINTU_AIR>
      <TANGGAL>2026-09-17T15:10:00+07:00</TANGGAL>
      <TINGGI_AIR>0</TINGGI_AIR>
      <TINGGI_AIR_SEBELUMNYA>0</TINGGI_AIR_SEBELUMNYA>
      <STATUS_SIAGA>Status : Normal</STATUS_SIAGA>
      <SIAGA1>3000</SIAGA1><SIAGA2>2500</SIAGA2><SIAGA3>1500</SIAGA3><SIAGA4>1</SIAGA4>
    </SP_GET_LAST_STATUS_PINTU_AIR></DocumentElement>`,
  );
  expect(() =>
    parseAngkeHuluXml(duplicate, {
      stationQuery: "Angke Hulu",
      stationDisplayName: "Angke",
      sourceUrl: "https://example.test",
    }),
  ).toThrow(StationAmbiguousError);
});

test("tren menggunakan nilai raw dan mempertahankan nilai negatif", () => {
  const reading = parseAngkeHuluXml(fixture, {
    stationQuery: "Angke Hulu",
    stationDisplayName: "Angke",
    sourceUrl: "https://example.test",
  });
  expect(trendFromReading(reading)).toBe("rising");
});
