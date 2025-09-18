FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S testfleet -u 1001

COPY server/package*.json ./

RUN npm ci --only=production

COPY server/ .

RUN chown -R testfleet:nodejs /app

USER testfleet

EXPOSE 3000

CMD ["node", "index.js"]