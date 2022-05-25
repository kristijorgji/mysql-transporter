#!/usr/bin/env bash

# Example usage:
# bash mysql-import /data/2021-06-13_16_31_42.sql

backupPath="$(pwd)/build/mysql-backups";

FILENAME="${1:-$FILENAME}"
if [ -z "$FILENAME" ]
then
      echo "\$FILENAME is missing"
      exit 1
fi

script_directory="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -o allexport; source ${script_directory}/dest-mysql.env; set +o allexport

read -r -d '' envPart <<EOF
#!/usr/bin/env bash

dest_host=$DEST_HOST;
dest_username=$DEST_USERNAME;
dest_password=$DEST_PASSWORD;
dest_database=$DEST_DATABASE;
dest_port="${DEST_PORT:-3306}";

filename=$FILENAME;

EOF

read -r -d '' importCmd <<'EOF'

function log() {
  ts=$(date +'%F_%H_%M_%S');
  echo "[$ts] $1"
}

log "Importing $filename into dest db"
mysql -h ${dest_host} -P ${dest_port} -u ${dest_username} -p${dest_password} ${dest_database} < "$filename"
log "Finished import";
EOF

importCmd="$envPart$importCmd";

echo "$importCmd" | docker run -i --rm --entrypoint '' \
  --platform linux/x86_64 \
  -v "$backupPath":/data \
  mysql:8.0.23 \
  /bin/bash
