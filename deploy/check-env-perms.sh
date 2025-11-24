#!/usr/bin/env bash
# Simple script to check recommended ownership and permissions for the EnvironmentFile used by systemd.
# Usage: sudo deploy/check-env-perms.sh /etc/realmint/realmint-api.env

set -euo pipefail

FILE=${1:-/etc/realmint/realmint-api.env}

if [ ! -e "$FILE" ]; then
  echo "ERROR: file not found: $FILE" >&2
  exit 2
fi

stat_out=$(stat -c "%U %G %a" "$FILE")
read -r owner group perms <<<"$stat_out"

echo "File: $FILE"
echo "Owner: $owner, Group: $group, Mode: $perms"

if [ "$owner" != "root" ]; then
  echo "Warning: recommended owner is root" >&2
fi

if [ "$perms" != "600" ]; then
  echo "Warning: recommended permissions are 0600 (rw-------)" >&2
fi

echo "If you need to fix permissions (run as root):"
echo "  sudo chown root:root $FILE"
echo "  sudo chmod 600 $FILE"

exit 0
