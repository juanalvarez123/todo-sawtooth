# https://nodejs.org/fr/docs/guides/nodejs-docker-webapp/

FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# EXPOSE 3000

CMD [ "node", "index.js" ]
