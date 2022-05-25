# mysql-transporter

Simple scripts to export one or multiple databases from one `mysql database` to another, verison `8.0.23`

Version can be changed easily in script.

## 1. Move one or multiple databases from one mysql server to another

1. First you need to fill the env vars for source and destination databases
   Start by copying the given example env vars
   ```bash
   cp source-mysql.env.example source-mysql.env
   cp dest-mysql.env.example dest-mysql.env
   ```
   Then fill with proper values  `source-mysql.env` and `dest-mysql.env`
2. Have fun, run
```bash
bash start-transfer.sh
```

and grab a coffee until it finishes.

## 2. Custom insert data from one table to another based on query you write
1. Modified `src/queries` 
    1. `source-queries.js` are executed on source db instance/connection
    2. `dest-queries.js` queries here are executed on dest instance/connection. Row data are ones selected in point a in source
2. Create `.env.local` based on example .env.example.
3. `ENVIRONMENT=local node src/index.js`

## Requirements

* Docker installed
* Node for usage nr 2

## License
Released under the MIT Licence. See the bundled LICENSE file for details.
