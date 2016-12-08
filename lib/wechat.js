'use strict';

const env = process.env.NODE_ENV || 'develop',
      namespace = `AiliBot:${env}`,
      leanCloud = require('./lean_cloud'),
      request = require('request'),
      redisClient = require('../redis_client');

const getAccessTokenFromWechat = (clientId) => {
  const query = new leanCloud.AV.Query('Client');
  return query.get(clientId)
    .then(lcClient => {
      const client = lcClient.toJSON(),
            url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${client.appId}&secret=${client.appSecret}`;

      return new Promise((resolve, reject) => {
        request({
          url,
          json: true
        }, (error, response, body) => {
          if (error) return reject(error);

          if (body.errcode) {
            reject(body);
          } else {
            resolve(body);
          }
        });
      });
    });
};

const getAccessToken = (clientId, options) => {
  options = options || {};
  const name = `${namespace}:wechat_access_token:${clientId}`;

  return new Promise((resolve, reject) => {
    redisClient.get(name, (error, reply) => {
      if (error) {
        return reject(error);
      }

      if (reply && !options.updateCache) {
        console.log('hit the cache:', reply);
        resolve(reply);
      } else {
        getAccessTokenFromWechat(clientId).then(data => {
          // Add to cache
          redisClient.set(name, data.access_token, (err, ret) => {
            if (err) {
              console.log(err);
            } else {
              console.log('added to the cache');
            }
          });
          // Set redis expire time as 1min less than actual access token expire time
          redisClient.expire(name, data.expires_in - 60);

          console.log(data.access_token);
          resolve(data.access_token);
        }, err => reject(err));
      }
    });
  });
};

module.exports = {
  getAccessToken
};
