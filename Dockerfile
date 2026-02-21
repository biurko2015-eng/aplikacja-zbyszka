# Build stage
FROM node:20-alpine AS builder

WORKDIR /app/APK-COMPASS

COPY APK-COMPASS/package.json APK-COMPASS/package-lock.json ./
RUN npm ci

COPY APK-COMPASS/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/APK-COMPASS/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/APK-COMPASS/.next/static ./.next/static
COPY --from=builder /app/APK-COMPASS/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
