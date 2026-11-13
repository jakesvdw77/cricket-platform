#!/bin/sh
# Runs once, the first time the database volume is created: one server, two databases.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" <<SQL
CREATE ROLE "$APP_DB_USER" LOGIN PASSWORD '$APP_DB_PASSWORD';
CREATE DATABASE "$APP_DB_NAME" OWNER "$APP_DB_USER";
CREATE ROLE "$KC_DB_USER" LOGIN PASSWORD '$KC_DB_PASSWORD';
CREATE DATABASE "$KC_DB_NAME" OWNER "$KC_DB_USER";
SQL
