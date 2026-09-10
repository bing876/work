FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# 平台会注入 PORT(如 Render);本地默认 3001。数据在 server/data/app.db,未挂盘则重建后丢失(仅验证可用)
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node", "server/index.mjs"]
