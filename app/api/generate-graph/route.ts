import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProject } from '@/lib/db/projects'
import { bulkCreateTopics, replaceTopicEdges } from '@/lib/db/topics'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const CLAUDE_MODEL = 'anthropic/claude-3.5-haiku'

async function openRouterChat(system: string, user: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log('[OpenRouter] Initializing request to', OPENROUTER_BASE)
    console.log('[OpenRouter] Model:', CLAUDE_MODEL)
    console.log('[OpenRouter] API Key present:', !!process.env.OPENROUTER_DEEPSEEK_API_KEY)

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    })

    console.log('[OpenRouter] Response status:', res.status)

    if (!res.ok) {
      const errorBody = await res.text()
      console.error(`[OpenRouter] API error: ${res.status}`, errorBody)
      throw new Error(`OpenRouter error: ${res.status} - ${errorBody}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      console.error('[OpenRouter] Empty response:', JSON.stringify(data))
      throw new Error('OpenRouter returned empty content')
    }
    return content
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error)
    console.error('[OpenRouter] Request failed:', errorDetails)
    console.error('[OpenRouter] Full error:', error)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

interface TavilyResult {
  title: string
  content: string
  url: string
}

async function searchTavily(query: string): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 8,
    }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectName, mainTopic } = await req.json()
    if (!projectName || !mainTopic) {
      return NextResponse.json({ error: 'projectName and mainTopic required' }, { status: 400 })
    }

    console.log('[generate-graph] Starting graph generation:', { projectName, mainTopic })

    // 1. Web search for learning roadmap
    console.log('[generate-graph] Searching Tavily for context...')
    const searchResults = await searchTavily(
      `${mainTopic} learning roadmap prerequisites subtopics syllabus`
    )
    const searchContext = searchResults
      .map(r => `Title: ${r.title}\nContent: ${r.content}`)
      .join('\n\n')
      .slice(0, 6000)
    console.log('[generate-graph] Found', searchResults.length, 'search results')

    // 2. Claude generates structured DAG (fast)
    console.log('[generate-graph] Calling OpenRouter for graph generation...')
    const raw = await openRouterChat(
      `Generate a JSON learning prerequisite graph.
- 6-10 nodes (topics)
- Each node: {id, name, description (short), level}
- Edges: {from, to} meaning "learn from before to"
- No cycles, main topic has highest level
- Return ONLY valid JSON`,
      `Topic: "${mainTopic}"
${searchContext ? `References: ${searchContext.slice(0, 2000)}` : ''}

Output this JSON:
{
  "nodes": [{"id":"n1","name":"X","description":"Y","level":0}],
  "edges": [{"from":"n1","to":"n2"}]
}`
    )

    console.log('[generate-graph] OpenRouter response received, parsing JSON...')
    console.log('[generate-graph] Raw AI response:', raw)
    let graph: { nodes: Array<{ id: string; name: string; description: string; level: number }>; edges: Array<{ from: string; to: string }> }
    try {
      // Extract the JSON object from the response — models often wrap it in text or code fences
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end === -1 || end < start) {
        throw new Error(`No JSON object found in response. Raw: ${raw.slice(0, 200)}`)
      }
      const jsonStr = raw.slice(start, end + 1)
      graph = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('[generate-graph] JSON parse failed:', parseError, 'Raw response:', raw)
      return NextResponse.json({ error: 'Failed to parse graph from AI', raw }, { status: 500 })
    }

    // 3. Save project + topics + edges to Supabase
    console.log('[generate-graph] Creating project and topics...')
    const project = await createProject(user.id, projectName, mainTopic)
    const createdTopics = await bulkCreateTopics(
      project.id,
      graph.nodes.map(n => ({ name: n.name, description: n.description }))
    )

    // Map temp IDs → real DB IDs
    const idMap = new Map<string, string>()
    graph.nodes.forEach((n, i) => {
      if (createdTopics[i]) idMap.set(n.id, createdTopics[i].id)
    })

    const edges = graph.edges
      .filter(e => idMap.has(e.from) && idMap.has(e.to))
      .map(e => ({ parent_id: idMap.get(e.from)!, child_id: idMap.get(e.to)! }))

    console.log('[generate-graph] Saving edges...')
    await replaceTopicEdges(createdTopics.map(t => t.id), edges)

    console.log('[generate-graph] Success! Project ID:', project.id)
    return NextResponse.json({ projectId: project.id })
  } catch (error) {
    console.error('[generate-graph] Fatal error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
