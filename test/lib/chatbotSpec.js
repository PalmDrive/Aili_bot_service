'use strict';

const chai = require('chai'),
      should = chai.should(),
      deepcopy = require('deepcopy'),
      Chatbot = require('../../lib/chatbot'),
      leanCloud = require('../../lib/lean_cloud');

const createClient = () => {
  const data = {
    name: 'test client',
    appId: 'wxe74948cd9929edc4',
    appSecret: '00a7f104fff19c9f21b33721466dcd82'
  };
  return leanCloud.createObjectWithData('Client', data);
};

const createUser = () => {
  const data = {
    open_id: 'test-user-open-id'
  };
  return leanCloud.createObjectWithData('WeChatUser', data);
};

const createMedia = () => {
  const data = {
    type: 'article',
    title: 'article title',
    summary: 'article summary',
    picurl: 'nopicurl',
    link: 'nolink'
  };
  return leanCloud.createObjectWithData('Media', data);
};

describe('Chatbot', () => {
  let chatbot,
      media,
      user,
      client;

  before(done => {
    const clientQuery = new leanCloud.AV.Query('Client'),
          userQuery = new leanCloud.AV.Query('WeChatUser'),
          mediaQuery = new leanCloud.AV.Query('Media');
    Promise.all([
      leanCloud.batchDestroy(clientQuery),
      leanCloud.batchDestroy(mediaQuery),
      leanCloud.batchDestroy(userQuery)
    ])
      .then(() => {
        return Promise.all([
          createMedia(),
          createUser(),
          createClient()
        ]);
      })
      .then(res => {
        media = res[0];
        user = res[1];
        client = res[2];
        chatbot = new Chatbot(client.id, 'WECHAT');
        return chatbot.init();
      })
      .then(() => done(), err => console.log('err:', err));
  });

  beforeEach(done => {
    chatbot.startedAt = new Date();
    done();
  });

  describe('sendWechatMessage method', () => {
    it('sends a single message', done => {
      const data = {
            msgtype: 'text',
            text: {content: 'hey'},
            touser: 'touser'
          };
      chatbot.sendWechatMessage(data)
        .then(res => {
          res.should.deep.equal([data]);
          done();
        }, err => {
          console.log('err:', err.stack);
        });
    });

    it('sends multiple messages', done => {
      const data = [{
            msgtype: 'text',
            text: {content: 'hey'},
            touser: 'touser',
          }, {
            msgtype: 'image',
            image: {media_id: 'xxxx'},
            touser: 'touser'
          }, {
            msgtype: 'music',
            music: {media_id: 'xxxx'},
            touser: 'touser'
          }];
      chatbot.sendWechatMessage(deepcopy(data))
        .then(res => {
          data.should.deep.equal(res);

          done();
        }, err => {
          console.log('err:', err.stack);
        });
    });
  });

  describe('sendWechatMessageWithMedia method', () => {
    it('sends message according to media', done => {
      const touser = user.get('open_id');
      let data = chatbot._getResDataFromMedia(media, touser);
      chatbot.sendWechatMessageWithMedia(media, user)
        .then(res => {
          res = res.filter(d => d.msgtype !== 'text');
          data = data.filter(d => d.msgtype !== 'text');
          res.should.deep.equal(data);
          done();
        }, err => console.log('err:', err.stack));
    });
  });
});
