'use strict';

const request = require('request'),
      _ = require('underscore'),
      leanCloud = require('../lib/lean_cloud'),
      wechat = require('../lib/wechat'),
      Chatbot = require('../lib/chatbot'),
      WeChatUser = leanCloud.AV.Object.extend('WeChatUser');

const onSubscribe = (data, chatbot, user) => {
  const query = new leanCloud.AV.Query('ScriptedResponse'),
        touser = data.fromusername,
        context = user.get('context') || {};

  query.equalTo('type', 'greeting');
  query.first()
    .then(response => {
      if (response) {
        const nextScriptedResUid = response.get('nextScriptedResUid');
        if (nextScriptedResUid) {
          context.currScriptedResUid = response.id
          context.nextScriptedResUid = nextScriptedResUid;
          user.set('context', context);
          user.save();
        }

        console.log('sending message');

        chatbot.sendWechatMessage(chatbot._getResDataFromScriptedRes(response, touser));
      } else {
        console.log('not corresponding response found');
      }
    }, err => {
      console.log('err:', err);
    });
};

const getUser = userId => {
  const query = new leanCloud.AV.Query('WeChatUser');
  query.equalTo('open_id', userId);
  return query.first();
};

const createUser = (userId, tasksDone) => {
  const weChatUser = new WeChatUser();
  tasksDone = tasksDone || 0;
  weChatUser.set('open_id', userId);
  weChatUser.set('tasks_done', tasksDone);
  weChatUser.set('status', 0);
  return weChatUser.save();
};

module.exports.post = (req, res, next) => {
  // Reply success to avoid error and repeated request
  res.send('success');

  const bot = new Chatbot(req.params.clientId, 'WECHAT');

  const data = req.body.xml,
        userId = data.fromusername;

  bot.startedAt = new Date();

  console.log(`At ${bot.startedAt} get user ${userId} response`);

  bot.init()
    .then(() => {
      return getUser(userId)
        .then(user => {
          if (user) {
            return user;
          } else {
            return createUser(userId);
          }
        });
    })
    .then(user => {
      console.log(`At ${bot._getTime()} get user ${userId} data from leancloud.`);

      if (data.msgtype === 'text') {
        // Intent to action
        if (data.content === 'reset') {
          return onSubscribe(data, user);
        } else if (
          data.content.match(/推荐/) ||
          data.content.match(/来吧/) ||
          data.content.match(/继续/) ||
          data.content.match(/喜欢/) ||
          data.content.match(/一般/)
        ) {
          return bot.onRecommend(data, user);
        }

        if (user.get('context') && user.get('context').nextScriptedResUid) {
          return bot.onReceiveAnsForScriptedRes(data, user);
        }

        // Default response
        return bot.sendDefaultResponse(data);
      } else if (data.msgtype === 'event') {
        if (data.event === 'subscribe') {
          onSubscribe(data, bot, user);
        }
      }
    })
    .catch(err => console.log('Caught err:', err.stack || err));
};

module.exports.get = (req, res, next) => {
  res.send(req.query.echostr);
};
