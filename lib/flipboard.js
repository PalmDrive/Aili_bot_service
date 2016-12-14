'use strict';

const sha1 = require('sha1'),
      request = require('request'),
      leanCloud = require('./lean_cloud'),
      _ = require('underscore');

const _featuredStoriesURL = 'https://flrms.flipchina.cn/featured_stories';

class Worker {
  constructor() {
    this.jobs = [];
  }

  init() {
    this.jobs.forEach(job => job.apply(this));
  }

  addJob(job) {
    this.jobs.push(job);
  }
}

class Flipboard {
  constructor(clientId) {
    this.clientId = clientId;
    this.worker = new Worker();
    return this;
  }

  getFeaturedStories() {
    const timestamp = parseInt(+ new Date() / 1000),
          encryptedSha = sha1(timestamp.toString()),
          buffer = Buffer.from(encryptedSha),
          auth = buffer.toString('base64');

    return new Promise((resolve, reject) => {
      request({
        url: _featuredStoriesURL,
        qs: {
          timestamp
        },
        headers: {
          'x-flipboard-auth': auth
        },
        json: true
      }, (err, response, body) => {
        if (err) { return reject(err); }

        if (body.success === false) {
          return reject(body.error);
        }

        resolve(body);
      });
    });
  }

  _createMediaWithData(data, isSaved) {
    const mediaData = {
      title: data.title,
      textContent: data.text,
      source: 'Flipboard',
      meta: data.author.name,
      picurl: data.image.url,
      type: 'article',
      link: data.linkURL
    };
    return leanCloud.createObjectWithData('Media', mediaData, isSaved);
  }

  createFeaturedStoriesJob(timeout) {
    timeout = timeout || 3 * 3600 * 1000; // 3 hours

    console.info('timeout:', timeout);

    const _logTime = () => {
      console.info(`At ${+new Date()}`);
    };

    const saveFeaturedStories = () => {
      _logTime();
      let medium;
      return this.getFeaturedStories()
        .then(data => {
          medium = data.items.map(d => this._createMediaWithData(d, false));
          const titles = medium.map(m => m.get('title')),
                query = new leanCloud.AV.Query('Media');

          query.containedIn('title', titles);
          return query.find();
        }).then(existedMedium => {
          const existedTitles = existedMedium.map(m => m.get('title'));
          medium = medium.filter(m => existedTitles.indexOf(m.get('title')) === -1);
          return leanCloud.AV.Object.saveAll(medium);
        })
        .then(data => {
          console.info(`Save ${data.length} medium to lean cloud.`);
          setTimeout(() => saveFeaturedStories(), timeout);
        })
        .catch(err => {
          console.error('Create featured stories job err:', err.stack || err);
          setTimeout(() => saveFeaturedStories(), timeout);
        })
    };

    return saveFeaturedStories;
  }

  initWorker(options) {
    const defaultOptions = {
      timeout: 3 * 3600 * 1000 // 3 hours
    };
    _.extend(defaultOptions, options || {});

    const job = this.createFeaturedStoriesJob(defaultOptions.timeout);
    this.worker.addJob(job);
    this.worker.init();

    console.info(`Flipboard worker initialized with timeout ${defaultOptions.timeout}.`);
  }
}

module.exports = Flipboard;
