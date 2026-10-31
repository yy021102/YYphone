FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs upstream.mjs ./
ENV HOST=0.0.0.0 PORT=3001 ENABLE_GENERAL_UNBLOCK=false ENABLE_PROXY=false
USER node
EXPOSE 3001
CMD ["node", "server.mjs"]
