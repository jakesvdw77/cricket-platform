#!/usr/bin/env bash
# Builds the Cricket Legend Keycloak login theme artifacts into keycloak/dist/:
#
#   cricketlegend-login-theme.zip   the theme folder, to unzip into /opt/keycloak/themes/
#                                   (the folder layout Keycloak reads directly; no `kc.sh build`)
#   cricketlegend-login-theme.jar   the same theme as a Keycloak theme provider JAR
#                                   (META-INF/keycloak-themes.json + theme/cricketlegend/...), for
#                                   /opt/keycloak/providers/ followed by `kc.sh build`
#
# Usage: keycloak/package.sh          (from anywhere; needs `zip`)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
theme="$here/themes/cricketlegend"
dist="$here/dist"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

[ -f "$theme/login/theme.properties" ] || { echo "theme not found at $theme" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

rm -rf "$dist"
mkdir -p "$dist"

# 1. Folder form: unzip inside /opt/keycloak/themes/ (it contains the cricketlegend/ directory).
mkdir -p "$stage/folder"
cp -R "$theme" "$stage/folder/cricketlegend"
(cd "$stage/folder" && zip -qr -X "$dist/cricketlegend-login-theme.zip" cricketlegend -x '*.DS_Store')

# 2. Provider JAR form: Keycloak expects theme/<name>/<type>/ plus META-INF/keycloak-themes.json.
mkdir -p "$stage/jar/theme" "$stage/jar/META-INF"
cp -R "$theme" "$stage/jar/theme/cricketlegend"
cp "$here/META-INF/keycloak-themes.json" "$stage/jar/META-INF/"
(cd "$stage/jar" && zip -qr -X "$dist/cricketlegend-login-theme.jar" META-INF theme -x '*.DS_Store')

echo "Built:"
ls -l "$dist"
