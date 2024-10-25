This project uses docker to simplify dependencies and installation.
Docker engine must be installed and running.

# Quickstart

Clone the project
Run

```shell
docker compose up frontend -d
docker compose up server -d
```

The server will now be running at `localhost:3001` and the frontend at `localhost:3000`

### Including kafka

The kafka related containers do not automatically start up with the rest of the server. To begin listening to kafka events first run the kafka container

```shell
docker compose up kafka -d
```

and then, once the kafka system is fully loaded, run the event consumer via

```shell
docker compose up eventconsumer -d
```

This will listen to, and record, any events recieved through kafka. The format of these events is available in the API specification. A simple and bare minimum event mocker is available through the PowerTrack_DataMocker project.

# Static Data

Currently the database is populated with a subset of consumers, suburbs, and generators; and the full set of warnings, through the `dbSetupInfo.json` file.  
Entries are added to the database sequentially through this file, and can be edited to change the data loaded at startup.  
Changes to this file will require a rebuild of docker containers, via `docker compose build server`

# Seperate startup

Individual docker compose files are available within the respective directories. Services within these can then be run independently using standard docker compose commands.
