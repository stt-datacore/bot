FROM node:lts-slim

WORKDIR /usr/src/bot

COPY . .

RUN npm install && npm run build

#CMD [ "node", "build/index.js" ]