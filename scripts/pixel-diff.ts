/**
 * Pixel comparison of two PNG images, decoded in a browser page (#190).
 *
 * Why: the design-audit screenshot compare and the per-mapping parity check
 * must count differing pixels the same way, without an image library.
 * What: `countDiffPixels` decodes both PNGs in a Chromium canvas and returns
 * how many pixels differ in any RGBA channel, or -1 when the sizes differ.
 * Test: exercised by `scripts/design-parity-pixels.ts`, whose one-step control
 * mapping must report a non-zero count; it needs a browser, so no unit test.
 */

import type { Page } from "playwright";

/**
 * Browser-side diff, kept as source text: tsx compiles functions with a
 * `__name` helper that does not exist in the page, so a function argument to
 * `page.evaluate` fails there.
 */
const PIXEL_DIFF = `async (da, db) => {
  const load = async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, px: ctx.getImageData(0, 0, img.width, img.height).data };
  };
  const [ia, ib] = await Promise.all([load(da), load(db)]);
  if (ia.w !== ib.w || ia.h !== ib.h) return -1;
  let count = 0;
  for (let i = 0; i < ia.px.length; i += 4) {
    if (ia.px[i] !== ib.px[i] || ia.px[i + 1] !== ib.px[i + 1] || ia.px[i + 2] !== ib.px[i + 2] || ia.px[i + 3] !== ib.px[i + 3]) count += 1;
  }
  return count;
}`;

/** Differing pixels between two PNG buffers; -1 when their sizes differ. */
export async function countDiffPixels(page: Page, a: Buffer, b: Buffer): Promise<number> {
  const uri = (buf: Buffer) => JSON.stringify(`data:image/png;base64,${buf.toString("base64")}`);
  return (await page.evaluate(`(${PIXEL_DIFF})(${uri(a)}, ${uri(b)})`)) as number;
}
