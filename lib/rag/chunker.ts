export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = []
  let start = 0
  const cleaned = text.replace(/\s+/g, ' ').trim()
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length)
    chunks.push(cleaned.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 40)
}
