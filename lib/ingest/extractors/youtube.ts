function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

export async function extractFromYoutube(url: string): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error(`Cannot extract video ID from: ${url}`);

  const { YoutubeTranscript } = await import("youtube-transcript");
  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  return transcript.map((t: { text: string }) => t.text).join(" ").trim();
}
