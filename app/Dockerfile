FROM node:20-alpine

# Instalar postgresql-client (inclui pg_dump, pg_restore, psql) e utilitários
# pg_dump must be >= the source server major version. Override with --build-arg PG_CLIENT_VERSION=17
ARG PG_CLIENT_VERSION=18
RUN apk add --no-cache postgresql${PG_CLIENT_VERSION}-client bash

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
