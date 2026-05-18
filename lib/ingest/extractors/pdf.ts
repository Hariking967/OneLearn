export async function extractFromPdf(buffer: ArrayBuffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(Buffer.from(buffer));
  return data.text.trim();
}
