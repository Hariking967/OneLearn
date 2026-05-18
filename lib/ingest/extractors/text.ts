export async function extractFromNote(content: string): Promise<string> {
  return content.trim();
}

export async function extractFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OneLearnBot/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 50000);
  } catch {
    return "";
  }
}
