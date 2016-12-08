'use strict';

const chai = require('chai'),
      should = chai.should(),
      deepcopy = require('deepcopy'),
      Chatbot = require('../../lib/chatbot'),
      leanCloud = require('../../lib/lean_cloud'),
      helpers = require('../utils/helpers');

describe('Chatbot', () => {
  let chatbot,
      media,
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
        chatbot = new Chatbot(client.id, 'WECHAT');
        return chatbot.init();
      })
      .then(() => done(), err => console.error('err:', err));
  });

  beforeEach(done => {
    leanCloud.batchDestroy(messageQuery)
      .then(() => {
        chatbot.startedAt = new Date();
      })
      .then(() => done(), err => console.error('err:', err));
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

  describe('onRecommend method', () => {
    it('recommends one media only once', done => {
      const touser = user.get('open_id'),
            newMediaData = {
              type: 'article',
              title: 'article title 2',
              summary: 'article summary 2',
              picurl: 'nopicurl2',
              link: 'nolink2',
              isActive: true
            },
            messageData = {
              type: 'text',
              receiverId: touser,
              senderId: 'aili_bot',
              media,
              content: 'hello world'
            };
      let newMedia;

      // create new media
      Promise.all([
        leanCloud.createObjectWithData('Media', newMediaData),
        leanCloud.createObjectWithData('Message', messageData)
      ])
        .then(res => {
          newMedia = res[0];
          return chatbot.onRecommend({fromusername: user.get('open_id')}, user)
        })
        .then(response => {
          let data = chatbot._getResDataFromMedia(newMedia, touser);
          response = response.filter(d => d.msgtype !== 'text');
          data = data.filter(d => d.msgtype !== 'text');
          response.should.deep.equal(data);
          done();
        }, err => console.log('err:', err.stack));
    });
  });
});
