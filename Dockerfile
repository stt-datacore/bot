FROM node:lts-alpine

RUN apk add --update-cache git

WORKDIR /usr/src/bot

COPY . .

RUN npm ci && npm run build && npm prune --production

ENV NODE_ENV=production

ENTRYPOINT [ "node", "build/index.js" ]
