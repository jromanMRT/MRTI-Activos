FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S mrtiassets \
  && adduser -S mrtiassets -G mrtiassets \
  && mkdir -p /app/storage/asset-documents \
  && chown -R mrtiassets:mrtiassets /app/storage

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER mrtiassets

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
