import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.OPENROUTER_DEEPSEEK_API_KEY
  const model = 'anthropic/claude-3.5-haiku'

  console.log('[Debug OpenRouter] Starting test...')
  console.log('[Debug OpenRouter] API Key present:', !!apiKey)
  console.log('[Debug OpenRouter] API Key starts with:', apiKey?.substring(0, 10) + '...')

  try {
    console.log('[Debug OpenRouter] Making fetch request...')
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" only.',
          },
        ],
      }),
    })

    console.log('[Debug OpenRouter] Response received, status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('[Debug OpenRouter] API error:', error)
      return NextResponse.json(
        { error: `API error ${response.status}`, details: error },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[Debug OpenRouter] Success:', data.choices?.[0]?.message?.content)
    return NextResponse.json({ success: true, response: data })
  } catch (error) {
    console.error('[Debug OpenRouter] Fetch failed:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Fetch failed', details: errorMsg }, { status: 500 })
  }
}
