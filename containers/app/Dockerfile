# https://nodejs.org/fr/docs/guides/nodejs-docker-webapp/
FROM node:10 as build

WORKDIR /app/client
COPY ./client/package*.json ./

WORKDIR /app/server
COPY ./server/package*.json ./

WORKDIR /app/client
RUN npm install --loglevel verbose

WORKDIR /app/server
RUN npm install --loglevel verbose

WORKDIR /app/server
COPY ./server .

WORKDIR /app/client
COPY ./client .
RUN npm run build

FROM node:10

WORKDIR /usr/src/app

COPY --from=build /app/server/ .

EXPOSE 3001

CMD [ "node", "bin/www" ]
