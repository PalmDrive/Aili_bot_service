'use strict';

const request = require('request'),
      _ = require('underscore'),
      env = process.env.NODE_ENV || 'develop',
      bosonnlpAPIKey = require(`../config/${env}.json`).bosonnlp.apiKey,
      bosonHeaders = {'X-Token': bosonnlpAPIKey};

const getSummary = (content, options) => {
  const url = 'http://api.bosonnlp.com/summary/analysis',
        defaultOptions = {percentage: 0.1};

  _.extend(defaultOptions, options || {});

  return new Promise((resolve, reject) => {
    request.post({
      url,
      headers: bosonHeaders,
      body: JSON.stringify({
        content,
        percentage: defaultOptions.percentage
      }) // add json: true will cause error
    }, (err, resp, body) => {
      if (err) { return reject(err); }

      resolve(JSON.parse(body));
    });
  });
};

const getKeywords = (content) => {
  const url = 'http://api.bosonnlp.com/keywords/analysis';

  return new Promise((resolve, reject) => {
    request.post({
      url,
      headers: bosonHeaders,
      body: content,
      json: true
    }, (err, resp, body) => {
      if (err) { return reject(err); }

      resolve(body);
    })
  });
};

module.exports = {
  getSummary,
  getKeywords
};
