#!/usr/bin/env bash

script_directory="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -o allexport; source ${script_directory}/source-mysql.env; set +o allexport

backupPath="$(pwd)/build/mysql-backups";
if [ ! -d $backupPath ]
then
    echo "Creating backups directory at $backupPath";
    mkdir -p "$backupPath";
fi

fname="$(date +'%F_%H_%M_%S').sql";
export FILENAME="/data/$fname";

read -r -d '' envPart <<EOF
#!/usr/bin/env bash

source_host=$SOURCE_HOST;
source_username=$SOURCE_USERNAME;
source_password=$SOURCE_PASSWORD;
source_database=$SOURCE_DATABASE;

filename=$FILENAME;
EOF

read -r -d '' exportCmd <<'EOF'

function log() {
  ts=$(date +'%F_%H_%M_%S');
  echo "[$ts] $1"
}

dir="/data/";
mkdir -p "$dir";

log "Starting to dump database $source_database into $filename";
mysqldump -h ${source_host} -u ${source_username} -p${source_password} \
  --lock-tables=false \
  --set-gtid-purged=OFF \
  --triggers \
  --routines \
  --events \
  --databases $source_database > "$filename";

log "Finished export, exporting FILENAME=$filename to current env bash session";
EOF

exportCmd="$envPart$exportCmd";

echo "$exportCmd" | docker run -i --rm --entrypoint '' \
  -v "$backupPath":/data \
  mysql:8.0.23 \
  /bin/bash
