const request = require('request');
const _ = require('lodash');

function getLandingPageId(apiEndpoint, siteId, accessToken) {
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
          const pages = _.sortBy(_.filter(body.pages, ['metadata.navigationItem', true]), 'metadata.index');
          resolve(pages[0] ? pages[0].id : null);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

module.exports = {getLandingPageId};