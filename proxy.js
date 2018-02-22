const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const redis = require('redis');
const oauth2 = require('simple-oauth2');
const fs = require('fs');
const getLandingPageId = require('./helpers').getLandingPageId;

/**
 * Handles the legwork in sniffing a request and deciding whether it should be proxied to the final target,
 * redirected, or sent to 404 or 500 status pages.
 */
class ProxyServer {

  static _isPassThroughRequest(url) {
    return /(\w+-\d+$)|(^\/p\/\d+)|(.js$)|(.css$)|(.ico$)|(.png$)|(.jpg$)|(.svg$)|(^\/api\/*)|(^\/404$)|(^\/500$)/.test(url);
  }

  static _doRedirect(res, target) {
    res.writeHeader(302, {Location: target});
    res.end();
  }

  static _handle500Error(req, res, err) {
    console.error(err);
    const redirect = `${req.connection.encrypted ? 'https' : 'http'}://${req.headers.host}/500`;
    ProxyServer._doRedirect(res, redirect);
  }

  static _handle404Error(req, res) {
    const redirect = `${req.connection.encrypted ? 'https' : 'http'}://${req.headers.host}/404`;
    ProxyServer._doRedirect(res, redirect);
  }

  static _sslRedirectHandler(req, res) {
    const url = `https://${req.headers.host}${req.originalUrl}`;
    ProxyServer._doRedirect(res, url);
  }

  static _didGetLandingPageId(req, res, pageId) {
    const host = req.headers.host;
    if (pageId) {
      const redirect = `${req.connection.encrypted ? 'https' : 'http'}://${host}/p/${pageId}`;
      ProxyServer._doRedirect(res, redirect);
    } else {
      ProxyServer._handle404Error(req, res);
    }
  }

  constructor(params) {
    this._clientId = params.clientId;
    this._clientSecret = params.clientSecret;
    this._apiEndpoint = params.apiEndpoint;
    this._db = redis.createClient(params.redisConfig);
    this._ssl = params.ssl;
    this._proxy = httpProxy.createProxyServer({
      ignorePath: true,
      secure: !!this._ssl,
      changeOrigin: true,
      preserveHeaderKeyCase: true,
      hostRewrite: true
    });
    this._port = params.port;
    this._finalTargetHost = params.host;
    this._token = null;
    this._tokenPoller = null;
  }

  bootstrap() {
    return new Promise((resolve, reject) => {
      this._db.on('error', err => {
        reject(err);
      });
      this._db.on('ready', () => {
        this._doClientAuthHandshake(this._clientId, this._clientSecret, this._apiEndpoint).then(token => {
          this._onClientAuthSuccess(token);
          this._createServer();
          resolve();
        }).catch(err => {
          throw err;
        });
      });
    });
  }

  _createServer() {
    if (this._ssl) {
      const key = fs.readFileSync(this._ssl.keyFile, 'utf-8');
      const cert = fs.readFileSync(this._ssl.certFile, 'utf-8');
      const ca = fs.readFileSync(this._ssl.caFile, 'utf-8');
      const options = {
        key: key,
        ca: [ca],
        cert: cert,
        requestCert: false,
        rejectUnauthorized: false
      };
      const sslServer = https.createServer(options);
      sslServer.addListener('request', this._serverHandler.bind(this));
      sslServer.listen(this._ssl.port);
      console.log(`Listening on ${this._ssl.port}`);
    }
    const server = http.createServer();
    server.addListener('request', this._serverHandler.bind(this));
    server.listen(this._port);
    console.log(`Listening on ${this._port}`);
  }

  _serverHandler(req, res) {
    try {
      // we will match the host against our database of known hosts and map these to the given "site" id
      this._db.hgetall(req.headers.host, (err, siteData) => this._didGetHostData(err, siteData, req, res));
    } catch (err) {
      ProxyServer._handle500Error(req, res, err);
    }
  }

  _didGetHostData(err, siteData, req, res) {
    if (err) {
      throw err;
    }
    if (ProxyServer._isPassThroughRequest(req.url)) {
      const target = `${this._finalTargetHost}${req.url}`;
      this._doProxyRequest(req, res, target);
    } else if (siteData) {
      if (siteData.landingPageId) {
        ProxyServer._didGetLandingPageId(req, res, siteData.landingPageId);
      } else {
        // if no result is produced in a reasonable amount of time, quit
        const timeout = setTimeout(() => {
          throw new Error('Failed to find landing page associated with this host');
        }, 5000);
        // lookup the first page of the site associated with this host
        getLandingPageId(this._apiEndpoint, siteData.siteId, this._token.raw.access_token).then(landingPageId => {
          this._db.hset(req.headers.host, 'landingPageId', landingPageId, err => {
            if (err) {
              throw err;
            }
            ProxyServer._didGetLandingPageId(req, res, landingPageId);
            clearTimeout(timeout);
          });
        }).catch(err => {
          throw err;
        });
      }
    } else {
      ProxyServer._handle404Error(req, res);
    }
  }

  _doProxyRequest(req, res, target) {
    console.log('did proxy request =>', target);
    this._proxy.web(req, res, {target: target});
  }

  _doClientAuthHandshake(clientId, clientSecret, apiEndpoint) {
    return new Promise((resolve, reject) => {
      const credentials = {
        client: {
          id: clientId,
          secret: clientSecret
        },
        auth: {
          tokenHost: apiEndpoint,
          tokenPath: '/oauth/token',
          authorizePath: '/oauth/authorize'
        }
      };
      const client = oauth2.create(credentials);
      client.clientCredentials.getToken().then(result => {
        const clientOAuthToken = {auth: client.accessToken.create(result), raw: result};
        console.log('Successfully authenticated client');
        resolve(clientOAuthToken);
      }).catch(err => {
        reject(err);
      });
    });
  }

  _onClientAuthSuccess(token) {
    // store the oauth token
    this._token = token;
    // set a timeout to automatically renew client credentials
    this._renewCredentialsWithTimeout(token.raw.expires_in * 1000);
  }

  _renewCredentialsWithTimeout(timeoutLength) {
    clearTimeout(this._tokenPoller);
    this._tokenPoller = setTimeout(() => {
      this._doClientAuthHandshake(this._clientId, this._clientSecret, this._apiEndpoint).then(token => {
        this._onClientAuthSuccess(token);
      }).catch(err => {
        throw err;
      });
    }, timeoutLength);
  }
}

module.exports = ProxyServer;