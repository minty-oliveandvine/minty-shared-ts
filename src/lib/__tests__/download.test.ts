// Handing the browser a file (lib/download.ts). Ported from minty-petty-cash-web's
// lib/__tests__/download.test.ts and minty-web's features/subscription/__tests__/download.test.ts,
// with one argument order (the content first, then the name) and one name rule (filename* first,
// then filename; only the last segment, split on "/" and "\").

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { filenameFromDisposition, saveBlob, saveTextFile } from "../download";

type Click = { href: string; download: string; inDocument: boolean; display: string };

describe("saveBlob(blob, filename) and saveTextFile(text, filename)", () => {
  const created: Blob[] = [];
  const revoked: string[] = [];
  const clicks: Click[] = [];
  const anchors: HTMLAnchorElement[] = [];

  beforeEach(() => {
    created.length = 0;
    revoked.length = 0;
    clicks.length = 0;
    anchors.length = 0;
    vi.useFakeTimers();
    // jsdom has no object URLs; these stand in for the browser's.
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (b: Blob) => {
        created.push(b);
        return `blob:test/${created.length}`;
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: (u: string) => revoked.push(u),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      anchors.push(this);
      clicks.push({
        href: this.getAttribute("href") ?? "",
        download: this.download,
        inDocument: document.body.contains(this),
        display: this.style.display,
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the blob FIRST, and clicks a hidden <a download> in the page holding its URL", () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    saveBlob(blob, "INV-0042.pdf");
    expect(created).toEqual([blob]);
    expect(clicks).toEqual([
      { href: "blob:test/1", download: "INV-0042.pdf", inDocument: true, display: "none" },
    ]);
  });

  it("removes the link at once, but revokes the URL only on the next tick", () => {
    saveBlob(new Blob(["x"]), "a.pdf");
    expect(document.body.contains(anchors[0])).toBe(false);
    expect(revoked).toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("removes the link and still revokes the URL when the click throws", () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    expect(() => saveBlob(new Blob(["x"]), "f.csv")).toThrow("blocked");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("keeps the filename exactly as given - no sanitising", () => {
    saveBlob(new Blob(["x"]), "Olive & Vine / Q3 breakdown.csv");
    expect(clicks[0].download).toBe("Olive & Vine / Q3 breakdown.csv");
  });

  it("saveTextFile takes the text first, prefixes a UTF-8 BOM, and is a CSV by default", async () => {
    saveTextFile("a,b\n", "b.csv");
    expect(created[0].type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await created[0].arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe("a,b\n");
    expect(clicks[0].download).toBe("b.csv");

    saveTextFile("hi", "c.txt", "text/plain");
    expect(created[1].type).toBe("text/plain");
  });
});

describe("filenameFromDisposition", () => {
  it.each([
    [
      "attachment; filename=reports_2026-10-01_to_2026-10-13.csv",
      "reports_2026-10-01_to_2026-10-13.csv",
    ],
    ['attachment; filename="reports 1.csv"', "reports 1.csv"],
    ['attachment; filename="a;b.csv"', "a;b.csv"],
    ["attachment; filename=  spaced.csv  ", "spaced.csv"],
    ["inline; filename=x.pdf", "x.pdf"],
    ["ATTACHMENT; FILENAME=Loud.CSV", "Loud.CSV"],
  ])("reads the plain name in %s as %s", (header, name) => {
    expect(filenameFromDisposition(header)).toBe(name);
  });

  it.each([
    ["attachment; filename*=UTF-8''caf%C3%A9.csv; filename=cafe.csv", "café.csv"],
    ["attachment; filename=cafe.csv; filename*=UTF-8''caf%C3%A9.csv", "café.csv"],
    ["attachment; filename*=utf-8''a%20b.csv", "a b.csv"],
    ["attachment; filename*=Utf-8''a%20b.csv", "a b.csv"],
    ["attachment; filename*=UTF-8'en'r%C3%A9sum%C3%A9.pdf", "résumé.pdf"],
  ])("prefers the UTF-8 filename* in %s: %s", (header, name) => {
    expect(filenameFromDisposition(header)).toBe(name);
  });

  it.each([
    ["attachment; filename*=UTF-8''%E0%A4%A; filename=plain.csv", "plain.csv"],
    ["attachment; filename*=ISO-8859-1''x.csv; filename=y.csv", "y.csv"],
  ])(
    "falls back to the plain name when filename* is malformed or not UTF-8: %s",
    (header, name) => {
      expect(filenameFromDisposition(header)).toBe(name);
    },
  );

  it.each([
    ["attachment; filename=../../etc/passwd", "passwd"],
    ["attachment; filename=dir\\sub\\x.csv", "x.csv"],
    ["attachment; filename=..\\..\\boot.ini", "boot.ini"],
    ["attachment; filename*=UTF-8''dir%2Fcaf%C3%A9.csv", "café.csv"],
    ["attachment; filename*=UTF-8''dir%5Cx.csv", "x.csv"],
  ])("keeps only the last path segment of %s: %s", (header, name) => {
    expect(filenameFromDisposition(header)).toBe(name);
  });

  it.each([
    null,
    undefined,
    "",
    "attachment",
    'attachment; filename=""',
    "attachment; filename=dir/",
    "attachment; filename=dir\\",
    "attachment; filename*=UTF-8''%E0%A4%A",
    "attachment; myfilename=x.csv",
  ])("finds no name in %s", (header) => {
    expect(filenameFromDisposition(header)).toBeNull();
  });
});
