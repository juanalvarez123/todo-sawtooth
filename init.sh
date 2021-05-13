#!/bin/bash

cd ./containers/tp1
  npm install
  rm ./.env
  cp ./.env.docker-compose ./.env
cd -

cd ./containers/tpauth
  npm install
  rm ./.env
  cp ./.env.docker-compose ./.env
cd -

cd ./containers/app/client
  npm install
  rm ./.env
  cp ./.env.docker-compose ./.env
cd -

cd ./containers/app/server
  npm install
  rm ./.env
  cp ./.env.docker-compose ./.env
cd -

cd ./containers/app_ledger_sync
  npm install
  rm ./.env
  cp ./.env.docker-compose ./.env
cd -
