'use strict';

const leanCloud = require('./lib/lean_cloud');

const query = new leanCloud.AV.Query('Media');
query.equalTo('source', 'Flipboard');

leanCloud.batchFind(query)
  .then(medium => {
    console.log('medium length:', medium.length);
    medium.forEach(m => m.set('isActive', true));
    return leanCloud.AV.Object.saveAll(medium);
  })
  .then(() => console.info('done'))
  .catch(err => console.error('err:', err.stack || err));
