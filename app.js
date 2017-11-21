const dotenv = require('dotenv');
dotenv.config();

const ProxyServer = require('./proxy');

const PORT = process.env.PORT || 80;
const TARGET_HOST = process.env.TARGET_HOST;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const API_ENDPOINT = process.env.API_ENDPOINT;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = process.env.REDIS_DB;
const REDIS_CONFIG = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB
};
const SSL_KEY_FILE = process.env.SSL_KEY_FILE;
const SSL_CERT_FILE = process.env.SSL_CERT_FILE;
const SSL_CA_FILE = process.env.SSL_CA_FILE;
const SSL_PORT = process.env.SSL_PORT || 443;

const proxy = new ProxyServer({
  host: TARGET_HOST,
  port: PORT,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  apiEndpoint: API_ENDPOINT,
  redisConfig: REDIS_CONFIG,
  ssl: isSslDefined() ? {
    keyFile: SSL_KEY_FILE,
    certFile: SSL_CERT_FILE,
    caFile: SSL_CA_FILE,
    port: SSL_PORT
  } : null
});

proxy.bootstrap().then(() => {
  console.log('Startup successful.');
}).catch(err => {
  throw err;
});

function isSslDefined() {
  return SSL_KEY_FILE && SSL_CERT_FILE && SSL_CA_FILE;
}
