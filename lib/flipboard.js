'use strict';

const sha1 = require('sha1'),
      request = require('request'),
      leanCloud = require('./lean_cloud'),
      bosonnlp = require('./bosonnlp'),
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

        //console.info('featured stories:', body);

        resolve(body);
      });
    });
  }

  _createMediaWithData(data, isSaved) {
    const mediaData = {
      title: data.title,
      source: 'Flipboard',
      meta: data.author && data.author.name,
      picurl: data.image && data.image.url,
      type: data.type,
      link: data.linkURL,
      summary: data.type === 'image' ? data.text : null,
      textContent: data.type === 'article' ? data.text : null,
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

          // Get summary and keywords for the new medium
          return Flipboard.setMediaSummaryAndKeywords(medium);
        })
        .then(medium => leanCloud.AV.Object.saveAll(medium))
        .then(data => {
          console.info(`Save ${data.length} medium to lean cloud.`);
          setTimeout(saveFeaturedStories, timeout);
        })
        .catch(err => {
          console.error('Create featured stories job err:', err.stack || err);
          setTimeout(saveFeaturedStories, timeout);
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

  static setMediaSummaryAndKeywords(medium) {
    return Promise.all(medium.map(media => {
      const content = media.get('textContent');
      if (content) {
        return Promise.all([
          bosonnlp.getKeywords(content),
          bosonnlp.getSummary(content)
        ])
          .then(res => {
            if (Array.isArray(res[0])) {
              const keywords = res[0]
                      .filter(tuple => tuple[0] > 0.1)
                      .map(tuple => tuple[1]);
              media.set('keywords', keywords);
            } else {
              console.log('Get keywords error:', res[0]);
            }
            if (typeof res[1] === 'string') {
              media.set('summary', res[1]);
            } else {
              console.log('Get summary error:', res[1]);
            }

            return media;
          });
      } else {
        return media;
      }
    }));
  }
}

module.exports = Flipboard;
