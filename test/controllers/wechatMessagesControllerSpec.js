'use strict';

const leanCloud = require('../../lib/lean_cloud'),
      ctrl = require('../../controllers/wechatMessagesController'),
      helpers = require('../utils/helpers');

const res = {
  send(response) {
    console.info(response);
    return response;
  }
};

describe('Wechat messages controller', function() {
  this.timeout(30000);

  let media,
      user,
      client;

  before(done => {
    Promise.all([
      helpers.removeClient(),
      helpers.removeMedia(),
      helpers.removeUser()
    ])
      .then(() => {
        return Promise.all([
          helpers.createMedia(),
          helpers.createUser(),
          helpers.createClient()
        ]);
      })
      .then(res => {
        media = res[0];
        user = res[1];
        client = res[2];
        return true;
      })
      .then(() => done(), err => console.error('err:', err));
  });

  it('sends wechat custom message when msgtype is text', done => {
    const req = {
      body: {
        xml: {
          fromusername: user.get('open_id'),
          tousernname: 'aili_bot',
          msgtype: 'text',
          content: '推荐'
        }
      },
      params: {
        clientId: client.id,
      }
    };

    ctrl.post(req, res);
  });

  it('sends wechat custom message when msgtype is event', done => {
    const req = {
      body: {
        xml: {
          fromusername: user.get('open_id'),
          tousernname: 'aili_bot',
          msgtype: 'event',
          event: 'subscribe'
        }
      },
      params: {
        clientId: client.id,
      }
    };

    ctrl.post(req, res);
  });
});
