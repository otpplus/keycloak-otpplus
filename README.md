# keycloak-otpplus

## Overview
We have implemented MFA on top of keycloak so that you don't have to. Batteries(SMS) included!

Keycloak image with OTP Plus® which has built in plugin to use SMS and Email based OTP as a factor

## Requirements
```
docker
docker-compose
```

## Database options

### Postgres
Keycloack Plus provides postgres container which can be easily integrated with Keycloak image
```
cd postgres
docker-compose up
Modify keycloak-plus/keycloak.specific.env to select KC_DB_URL based on your platform
```

### Other Database
Keycloak has a list of supported database. If not using postgres, please set up `KC_DB_JDBC` variable based on your DB
https://www.keycloak.org/server/db
Modify `KC_DB_USERNAME` and `KC_DB_PASSWORD` in keycloak.specific.env

## OTP Plus® access key
Enter the access key in keycloak-plus/keycloak.specific.env `KC_ACCESS_KEY`

## Keycloak Plus logging

Keycloak Plus logging is enabled by default. Logging parameters can be modified in keycloak.specific.env
Docker-compose by default mounts `/opt/keycloak/data` directory on the container to host machine `/var/log/kcplus`. Please change the volume mount location if needed 

## Keycloak Plus initial access admin user

Admin username/password can be modified in keycloak.specific.env

Default username/password is
```
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
``` 

## Run Keycloak Plus
```
cd keycloak-plus
docker-compose up
```

