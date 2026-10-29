FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @portfolio/api build
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node","apps/api/dist/server.js"]
