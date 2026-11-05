FROM node:24-bookworm-slim

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build

ENV NODE_ENV=development
ENV PORT=7077

EXPOSE 7077

CMD ["npm", "start"]
