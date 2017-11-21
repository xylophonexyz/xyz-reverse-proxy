# Deployment
We deploy this app using the supplied Dockerfile. We require that this app
connects to a redis instance where the mappings between hosts and
their respective site id's are defined.

## Clone the repository
```bash
git clone https://github.com/jasonaibrahim/xyz-reverse-proxy.git
cd xyz-proxy
```

## Add Environment variables

You can pass environment variables to the docker instance manually, or via a .env file, e.g.
```bash
vi .env

API_ENDPOINT=https://api.xylophonexyz.com
API_VERSION=v1
TARGET_HOST=https://xyz-base-staging.herokuapp.com
CLIENT_ID=*****
CLIENT_SECRET=*****
REDIRECT_URI=https://xyz-base-staging.herokuapp.com/callback/email
PORT=8080
REDIS_HOST=redis-10338.c1.us-central1-2.gce.cloud.redislabs.com
REDIS_PORT=6379
REDIS_DB=13
```

## Add SSL Certificates
To run this container over SSL you will need to provide valid SSL certs. The application will use these on startup.

The file names must match the following:
- proxy_xylophonexyz_com.ca-bundle
- proxy_xylophonexyz_com.key
- proxy_xylophonexyz_com.crt

```bash
vi proxy_xylophonexyz_com.ca-bundle
vi proxy_xylophonexyz_com.key
vi proxy_xylophonexyz_com.crt
```

## Build the proxy server docker image

Build the docker image

```
docker build -t xyz-proxy .
```

## Running Standalone
 
Start the app with auto restart enabled:

```bash
docker run --restart on-failure:5 --name xyz-custom-domain-proxy -p 80:8080 -p 443:8443 xyz-proxy
```

## Running Proxy Alongside Redis Using Docker

Grab the docker image from docker hub:

```bash
docker pull redis
```

Find the redis image:
```bash
docker images
```
```bash
REPOSITORY          TAG                 IMAGE ID            CREATED             SIZE
xyz-proxy           latest              a07332ff12e0        6 minutes ago       696MB
redis               latest              d4f259423416        5 weeks ago         106MB
```

Create a named network called "redis"

```
docker network create redis
```

Run redis, and expose the 6379 port if you wish.
```
docker run -d -p 6379:6379 -v ~/redisdata:/data --net "redis" --name redis redis
```

This runs redis in persistence mode, enabling backups to be made to the given directory, `redisdata`.

Note: this exposes the `6379` port to the outside world. Consider hiding this port behind a firewall or using a 
password to access.

## Troubleshooting
You may get the following error from time to time:
```bash
docker: Error response from daemon: Conflict. The container name "/redis" is already in use by container "9c19155b3d2ee06ba04a0f5a0e69d805db9ab73ba62cd860bd602050bc39b557". You have to remove (or rename) that container to be able to reuse that name.
```

Simply remove the container:
```bash
docker container rm 9c19155b3d2ee06ba04a0f5a0e69d805db9ab73ba62cd860bd602050bc39b557
```

and then restart the redis image (same as above)
```
docker run -d -p 6379:6379 -v ~/redisdata:/data --net "redis" --name redis redis
```

## Enter the redis container 
Run redis-cli:
```
docker exec -it redis redis-cli
```

Run bash:
```
docker exec -it redis bash
```

Run the proxy server, using the named network defined in the previous step

```
docker run --net "redis" -d -p 80:8080 -p 443:8443 xyz-proxy
```

## Notes
As long as there is a host defined in redis, the requests will be proxied
to the corresponding page. The target will be defined by the environment (e.g. https://xyz-base-staging.herokuapp.com). 

For example:

In redis:
```
{<host>: <site id>}

{"example.com": "6"}
```

- request "example.com/p/12"
    - Proxied to "https://xyz-base-staging.herokuapp.com/p/12"
- request "example.com"
    - look up site id 6
    - find first page (e.g. page id 10)
    - redirect to "example.com/p/10"
    - go to use previous use case "request example.com/p/10"
- cannot find host in redis
    - serve 404 page
- error
    - serve error page

## SSL
Place the private key, certificate, and ca certificates at the root of the directory, and reference them in
your environment variables or .env file

```bash
SSL_KEY_FILE=proxy_xylophonexyz_com.key
SSL_CERT_FILE=proxy_xylophonexyz_com.crt
SSL_CA_FILE=proxy_xylophonexyz_com.ca-bundle
```
