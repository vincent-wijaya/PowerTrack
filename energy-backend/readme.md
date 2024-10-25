## Running the backend

You can either run the backend in a production style environment, or a development style environment.

Production containers are the basic form, they load up the backend with basic data inserted into the database (see contents of `dbSetupInfo.json`). Development containers add ontop of this extra data, with fake entries for the profit, consumption, and generation related tables. It also enables node debugging, which can be access through the "Docker: Attach to Node" launch config.  
In both instances when running the server, the database is also run as a dependency.

### To run production containers

Make sure you are inside the `energy-backend` folder

To just run the server and database use

```shell
docker compose up server
```

To run the server, database, and kafka listener use both (will need two terminals)

```shell
docker compose up kafka
docker compose up server
```

(This will also run the server and database)

### To run debug/development containers

To run just the server and database use

```shell
docker compose -f ./compose.debug.yaml up debug-server
```

To run the server, database, and kafka listener use both (will need two terminals)

```shell
docker compose -f ./compose.debug.yaml up kafka
docker compose -f ./compose.debug.yaml up debug-eventconsumer
```
