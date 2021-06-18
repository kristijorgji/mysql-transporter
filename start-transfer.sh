#!/usr/bin/env bash

script_directory="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source ${script_directory}/mysql-export.sh;
source ${script_directory}/mysql-import.sh;
