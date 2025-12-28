# Production Dockerfile for Next.js App with MCP Server Support
# This includes Node.js and npx for running the CalDAV MCP server

FROM node:22-slim AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --prod --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install all dependencies (including devDependencies) for build
RUN pnpm install --frozen-lockfile

# Build the Next.js app
# This will generate the standalone output
RUN pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install git (required by MCP server) and Python (for Time MCP server)
RUN apt-get update && \
    apt-get install -y git python3 python3-pip python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Time MCP server
RUN pip3 install --break-system-packages mcp-server-time

# Create a non-root user with home directory
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs

# Set the correct permissions for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Create npm cache directory for nextjs user
RUN mkdir -p /home/nextjs/.npm && chown -R nextjs:nodejs /home/nextjs

# Copy the standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Set hostname to allow connections from outside the container
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Start the Next.js production server
CMD ["node", "server.js"]
