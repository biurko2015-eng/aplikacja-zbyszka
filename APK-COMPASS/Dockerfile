# Build stage
FROM node:20-alpine AS builder

WORKDIR /app/ak-qualrix

COPY ak-qualrix/package.json ak-qualrix/package-lock.json ./
RUN npm ci

COPY ak-qualrix/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/ak-qualrix/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/ak-qualrix/.next/static ./.next/static
COPY --from=builder /app/ak-qualrix/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
