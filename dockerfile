# Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# Install Server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY server/ ./

# Final Image
FROM node:20-alpine
WORKDIR /app

COPY --from=server-build /app/server ./server
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 3000
CMD ["node", "server/index.js"]
#RUN addgroup -g 1001 -S nodejs && \
#    adduser -S testfleet -u 1001
#COPY server/package*.json ./
#RUN npm ci --only=production
#COPY server/ .
#RUN chown -R testfleet:nodejs /app
#USER testfleet
# Expose port
#EXPOSE 3000
# Start the server
#CMD ["node", "index.js"]