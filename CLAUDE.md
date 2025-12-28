# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application that uses AI agents (via Anthropic Claude) to help users optimize AWS workload provisioning and reduce infrastructure costs. The app integrates with:

- **Instances MCP** (via SSE transport) for AWS instance catalog and pricing data
- **MiniZinc** (constraint solver via MCP server) for workload optimization using constraint programming
- **assistant-ui** for the chat interface

## Development Commands

### Running the Application

```bash
npm run dev           # Start development server with Turbopack (http://localhost:3000)
npm run build         # Production build
npm start             # Start production server
```

### Code Quality

```bash
npm run lint          # Run ESLint
npm run prettier      # Check code formatting
npm run prettier:fix  # Fix code formatting
```

### Environment Setup

Copy `.env.example` to `.env.local` and configure:

- `ANTHROPIC_API_KEY` - Required for Claude models
- `NEXT_PUBLIC_ASSISTANT_BASE_URL` - Optional for assistant-ui cloud persistence

## Architecture

### AI Agent System (`app/api/chat/route.ts`)

The core agent (`workloadAgent`) is built using Vercel AI SDK's Agent API with:

- **Model**: `claude-haiku-4-5-20251001` with extended reasoning (12k token budget)
- **Tools**: Combined toolset from two MCP servers
  - MiniZinc (via SSE transport): Constraint solving for workload optimization
  - Instances MCP (via SSE transport): AWS instance catalog and pricing data
- **Stop condition**: Maximum 1000 steps per conversation
- **System prompt**: Configured to help with AWS workload provisioning and cost optimization using constraint programming

The agent streams responses using `toUIMessageStreamResponse()` for real-time UI updates.

### MCP Server Integration

Two MCP servers are initialized at module load:

1. **MiniZinc MCP** (HTTP/SSE)
   - URL: `https://minizinc-mcp.up.railway.app/sse`
   - Provides constraint solver tools for workload optimization

2. **Instances MCP** (HTTP/SSE)
   - URL: `https://instances-mcp.vantage.sh/mcp/e1e3a775-73b5-4afb-86c0-f433c8144b5a`
   - Provides AWS instance catalog and pricing data

### Frontend Architecture

- **app/page.tsx**: Entry point rendering `<Assistant />` component
- **app/assistant.tsx**: Sets up `AssistantRuntimeProvider` with chat transport pointing to `/api/chat`
- **components/assistant-ui/**: Custom UI components for the chat interface
  - `thread.tsx`: Main chat thread display
  - `thread-list.tsx`: Thread history management
  - `markdown-text.tsx`: Markdown rendering for messages
  - `tool-fallback.tsx`: Fallback UI for tool calls
  - `attachment.tsx`: Attachment handling
- **components/ui/**: shadcn/ui components (New York style, Zinc color scheme)

### Path Aliases

TypeScript configured with `@/*` aliasing to repository root:

- `@/components` → `/components`
- `@/lib` → `/lib`
- `@/hooks` → `/hooks`

### Styling

- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** components with CSS variables for theming
- **Framer Motion** for animations
- Globals defined in `app/globals.css`

## Key Dependencies

- **AI SDK**: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/mcp` - Agent and MCP integration
- **assistant-ui**: `@assistant-ui/react`, `@assistant-ui/react-ai-sdk` - Chat UI framework
- **React 19** with Next.js 15 App Router
- **Zustand**: State management (likely used in assistant-ui components)

## Important Notes

- MCP clients are created at module initialization (top-level await), so server startup may be slower
- The agent uses extended thinking with a 12k token budget for complex optimization tasks
- The `mcp-tools-ref.ts` file in the root is excluded from TypeScript compilation (likely reference documentation)
