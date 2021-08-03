#ENV := local

check-env:
ifndef ENV
	$(error ENV is undefined)
endif

resume: check-env
	ENVIRONMENT=$(ENV) node src/index.js

start-fresh: check-env
	rm state.$(ENV).json; ENVIRONMENT=$(ENV) node src/index.js
