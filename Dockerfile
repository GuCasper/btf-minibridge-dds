FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json api.js dds.js server.js minibridge-dds-analysis.mjs ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
