#!/usr/bin/env node
import process from 'node:process'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const API = (process.env.DATA4LIFE_API_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.DATA4LIFE_BEARER_TOKEN ?? ''

async function apiFetch(path) {
  if (!API || !TOKEN) {
    return { ok: false, text: 'Set DATA4LIFE_API_URL and DATA4LIFE_BEARER_TOKEN (Cognito id_token).' }
  }
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, text: `HTTP ${res.status}: ${text.slice(0, 2000)}` }
  return { ok: true, text }
}

const server = new Server({ name: 'data4life-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_whoop_dashboard',
      description:
        'Read-only: fetch aggregated WHOOP dashboard JSON from the Data4Life API (recovery, sleep, strain, workouts).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'get_whoop_insights',
      description:
        'Read-only: request a short bounded wellness summary derived from dashboard data (heuristic or Bedrock if configured on the API).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name
  if (name === 'get_whoop_dashboard') {
    const r = await apiFetch('/dashboard')
    return { content: [{ type: 'text', text: r.text }] }
  }
  if (name === 'get_whoop_insights') {
    const res = await fetch(`${API}/insights/summary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    const text = await res.text()
    if (!res.ok) {
      return { content: [{ type: 'text', text: `HTTP ${res.status}: ${text.slice(0, 2000)}` }] }
    }
    return { content: [{ type: 'text', text }] }
  }
  throw new Error(`Unknown tool: ${name}`)
})

const transport = new StdioServerTransport()
await server.connect(transport)
