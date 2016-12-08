'use strict';

const redis = require('redis'),
      client = redis.createClient({
        host: '127.0.0.1'
      });

client.on('connect', function() {
  console.log('redis server connected.');
});

module.exports = client;
