'use strict';

const Flipboard = require('../../lib/flipboard'),
      chai = require('chai'),
      should = chai.should(),
      helpers = require('../utils/helpers'),
      leanCloud = require('../../lib/lean_cloud');

const fp = new Flipboard();

describe('Flipboard', function() {
  this.timeout(30 * 1000);

  before(done => {
    helpers.removeMedia()
      .then(() => done())
      .catch(err => console.error('err:', err.stack || err));
  });

  it('get featured stories', done => {
    fp.getFeaturedStories()
      .then(body => {
        body.items.should.not.be.empty;
        console.log('items count:', body.count);
        console.log('first item:', body.items[0]);
        done();
      })
      .catch(err => console.error('err:', err.stack || err));
  });

  it('init worker to save feature stories repeatly', done => {
    fp.initWorker({timeout: 10 * 1000 /* 10 sec */});
    setTimeout(() => {
      const q = new leanCloud.AV.Query('Media');
      q.find()
        .then(data => {
          data.length.should.equal(30);
          done();
        })
        .catch(err => console.error('err:', err.stack || err));
    }, 15 * 1000);
  });
});
