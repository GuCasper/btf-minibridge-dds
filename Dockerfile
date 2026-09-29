FROM node:22-bookworm-slim

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

USER node
CMD ["node", "server.js"]
