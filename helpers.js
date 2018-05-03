const request = require('request');
const _ = require('lodash');

function getSite(apiEndpoint, siteId, accessToken) {
  return new Promise((resolve, reject) => {
    const headers = {Authorization: `Bearer ${accessToken}`};
    request({
      url: `${apiEndpoint}/v1/compositions/${siteId}`,
      headers: headers
    }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        try {
          const body = JSON.parse(response.body);
          resolve(body);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

function getLandingPageId(site) {
  const pages = _.sortBy(_.filter(site.pages, ['metadata.navigationItem', true]), 'metadata.index');
  return pages[0] ? pages[0].id : null;
}

module.exports = {getLandingPageId, getSite};