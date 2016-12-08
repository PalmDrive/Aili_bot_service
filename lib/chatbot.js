'use strict';

const apiJSON = require('./apiJSON'),
      _ = require('underscore'),
      leanCloud = require('./lean_cloud'),
      wechat = require('./wechat'),
      request = require('request'),
      Message = leanCloud.AV.Object.extend('Message'),
      env = process.env.NODE_ENV || 'develop';

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

// const intentToAction = {
//   'next_rec': 'nextRec',
//   'next_clip': 'nextClip',
//   'next_similar': 'nextSimilar',
//   'change_topic': 'changeTopic',
//   'random_ans': 'getRandomReply'
// };

class Chatbot {
  constructor(clientId, type) {
    this.clientId = clientId;
    this.type = type;

    return this;
  }

  init() {
    return new Promise((resolve, reject) => {
      if (this.type === 'WECHAT') {
        return wechat.getAccessToken(this.clientId)
          .then(token => {
            this.accessToken = token;
            resolve();
          }, reject);
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Send a message using 客服接口; Support sending multiple messages
   * params {Array | Object} data: array of messages data or single message data
   */
  sendWechatMessage(data) {
    const accessToken = this.accessToken;

    let res = [];

    if (!Array.isArray(data)) {
      data = [data];
    }

    const delay = 500;

    return new Promise((resolve, reject) => {
      if (data.length === 1) {
        console.log('send to user:', data[0]);
        res = res.concat(data);

        if (env === 'test') { // For testing
          console.log(`At ${this._getTime()} sending message to user ${data[0].touser}`);
          resolve(res);
        } else {
          console.log(`At ${this._getTime()} sending message to user ${data[0].touser}`);

          request.post({
            url: `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`,
            json: true,
            body: data[0]//_.omit(data[0], '_startedAt')
          }, (error, response, body) => {
            if (error) { return
              console.log('Send message error:', error);
              console.log(`At ${this._getTime()} failed to sent message to user ${data[0].touser}`);
              reject(error);
            }
            if (body.errcode) {
              console.log('Send message error:', body);
              console.log(`At ${this._getTime()} failed to sent message to user ${data[0].touser}`);
              reject(res);
            } else {
              console.log(`At ${this._getTime()} sent message successfully to user ${data[0].touser}`);
              resolve(res);
            }
          });
        }
      } else {
        const data1 = data.shift();
        res = res.concat(data1);
        this.sendWechatMessage(data1)
          .then(() => {
            setTimeout(() => {
              this.sendWechatMessage(data)
                .then(body => {
                  res = res.concat(body);
                  resolve(res);
                }, err => reject(err));
            }, delay);
          }, err => {
            reject(err);
          });
      }
    });
  }

  sendWechatMessageWithMedia(media, user) {
    const accessToken = this.accessToken,
          touser = user.get('open_id');

    if (media) {
      if (!Array.isArray(media)) {
        media = [media];
      }
      console.log(`At ${this._getTime()} got recommended media from leancloud for user ${touser}`);

      const responseData = this._getResDataFromMedia(media, touser),
            msgs = media.map(m => {
              const msg = new Message();
              msg.set('content', m.get('title'));
              msg.set('senderId', 'aili_bot');
              msg.set('receiverId', touser);
              msg.set('media', m);
              msg.set('type', m.get('type'));
              return msg;
            });

      // Save rec response in Message
      leanCloud.AV.Object.saveAll(msgs)
        .then(() => {
          console.log('messages saved.');
        }, err => console.log('msgs save err:', err));

      // Update context
      const context = user.get('context') || {};
      context.currScriptedResUid = '';
      context.nextScriptedResUid = '';
      user.set('context', context);
      user.save();

      return this.sendWechatMessage(responseData);
    } else {
      return this.sendWechatMessage({
        msgtype: 'text',
        touser,
        text: {content: '哎哟，今天没有啦，明天见！'}
      });
    }
  }

  onReceiveAnsForScriptedRes(data, user) {
    const context = user.get('context'),
          touser = data.fromusername,
          query = new leanCloud.AV.Query('ScriptedResponse');
    query.equalTo('uid', context.nextScriptedResUid);

    return query.first()
      .then(response => {
        const responseData = this._getResDataFromScriptedRes(response, touser),
              msg = new Message();

        // Save user response in Message
        msg.set('content', data.content);
        msg.set('currScriptedResUid', context.currScriptedResUid);
        msg.set('nextScriptedResUid', context.nextScriptedResUid);
        msg.set('receiverId', 'aili_bot');
        msg.set('senderId', touser);
        msg.set('type', 'text');
        msg.save();

        // Update context
        context.currScriptedResUid = context.nextScriptedResUid;
        context.nextScriptedResUid = response.get('nextScriptedResUid') || '';
        user.set('context', context);
        user.save();

        return this.sendWechatMessage(responseData);
      });
  }

  onRecommend(data, user) {
    const touser = data.fromusername;
    return this._getRecommendedMediaId(user.get('open_id'))
      .then(mediaIds => {
        console.log(`At ${this._getTime()} got mediaIds from leancloud for user ${touser}`);

        const mediaIdsStr = '(' + mediaIds.map(id => '\'' + id + '\'') + ')',
              cql = `select * from Media where objectId not in ${mediaIdsStr} and (wechat_media_id is exists or items is exists) and isActive = true order by createdAt ASC limit 0, 1000`;

        console.log(`mediaIds: ${mediaIds}`);

        return leanCloud.AV.Query.doCloudQuery(cql)
          .then(data => data.results[0]);
      })
      .then(media => {
        return this.sendWechatMessageWithMedia(media, user);
      });
  }

  sendDefaultResponse(data) {
    // const replies = ['你真棒!', '真的嘛?', '然后呢~', '嗯嗯', '不想理你了', '没明白...喜欢我推荐的内容吗？', '喜欢就要说出来'],
    //       content = replies[getRandomInt(0, replies.length)];
    const url = 'http://www.tuling123.com/openapi/api',
          key = '8d418a2606b043b4bdfd3bc731fcc3a5';
    return new Promise((resolve, reject) => {
      request.post({
        url,
        json: true,
        body: {
          key,
          userid: data.fromusername,
          info: data.content
        }
      }, (err, response, body) => {
        if (err) {
          console.log('tuling api error:', err);
          return reject(err);
        }
        resolve(body.text);
      });
    })
      .then(content => {
        return this.sendWechatMessage([{
          touser: data.fromusername,
          msgtype: 'text',
          text: {content}
        },
        {
          touser: data.fromusername,
          msgtype: 'text',
          text: {content: '虽然也想陪你聊天，但是我最擅长的是内容推荐哦。回复"推荐"，看看还有什么有意思的内容吧。'}
        }]);
      });
    // request.post({
    //   url,
    //   json: true,
    //   body: {
    //     key,
    //     userid: data.fromusername,
    //     info: data.content
    //   }
    // })

    // return sendMessage({
    //   touser: data.fromusername,
    //   msgtype: 'text',
    //   text: {content}
    // }, accessToken);
  }

  // @return {Promise} response
  onReceiveMessage(queryStr) {
    const result = this.getIntent(queryStr);
    return this[result.action](result.parameters);
  }

  // Actions
  nextRec(params) {
    const query = new leanCloud.AV.Query('Media');
    return this._getRecommendedMediaId()
      .then(mediaIds => {
        console.log(`mediaIds: ${mediaIds}`);

        query.notContainedIn('objectId', mediaIds);
        return query.first();
      })
      .then(media => {
        if (media) {
          const response = {
                  type:media.get('type')
                };

          apiJSON.addRelatedResource(response, {
            id: media.id,
            attributes: media.toJSON()
          }, 'media');

          return response;
        } else {
          return {
            type: 'text',
            content: '哎哟，今天没有啦，明天见！'
          };
        }
      });
  }

  changeTopic(params) {

  }

  nextSimilar(params) {

  }

  nextClip(params) {

  }

  intro() {
    return new Promise(resolve => {
      resolve({
        type: 'text',
        content: '你好, 我是Aili。我每天会为你挑选你感兴趣的有意思内容。'
      });
    });
  }

  getRandomReply() {
    const replies = ['你真棒!', '真的嘛?', '然后呢~', '嗯嗯', '不想理你了'],
          content = replies[getRandomInt(0, replies.length)];

    return new Promise(resolve => {
      resolve({
        type: 'text',
        content
      });
    });
  }

  /**
  {
    "id": "7cf8f19f-7af3-40d5-a922-21e954b23b7b",
    "timestamp": "2016-11-20T08:58:03.042Z",
    "result": {
      "source": "agent",
      "resolvedQuery": "继续吧",
      "action": "nextRec",
      "actionIncomplete": false,
      "parameters": {},
      "contexts": [],
      "metadata": {
        "intentId": "d54dc16e-e788-4bd1-a750-fcc508b0a106",
        "webhookUsed": "false",
        "intentName": "next_rec"
      },
      "fulfillment": {
        "speech": "",
        "messages": [
          {
            "type": 0,
            "speech": ""
          }
        ]
      },
      "score": 1
    },
    "status": {
      "code": 200,
      "errorType": "success"
    },
    "sessionId": "fa42b74c-b671-46a6-88f2-d5f564c23543"
  }
  */
  getIntent(queryStr) {
    if (queryStr.match('biu')) {
      return {
        action: 'nextRec',
        parameters: {}
      }
    } else if (queryStr.match('你好')) {
      return {
        action: 'intro',
        parameters: {}
      }
    } else {
      return {
        action: 'getRandomReply',
        parameters: {}
      };
    }
  }

  /** --- Private methods --- */

  _getTime() {
    return (new Date() - this.startedAt || 0) + ' ms';
  }

  /**
   * @param  {Object | Array} media  for articles, media could be array of medium.
   *                                 otherwise, it is media leancloud object
   * @param  {String} touser
   * @return {Array} data
   */
  _getResDataFromMedia(media, touser) {
    if (!Array.isArray(media)) {
      media = [media];
    }
    let msgtype =  media[0].get('type'),
          mediaJSON = media[0].toJSON();

    if (msgtype === 'article') {
      msgtype = 'news';
    }

    let data = [
      {
        touser,
        msgtype
      }
    ];

    switch (msgtype) {
      case 'video':
        data[0].video = {
          media_id: mediaJSON.wechatMediaId,
          title: '【视频】' + mediaJSON.title,
          description: mediaJSON.summary
        };
        break;
      case 'news':
        data[0].news = {
          articles: media.map(m => {
            return {
              title: m.get('title'),
              //description: mediaJSON.summary,
              url: m.get('link'),
              picurl: m.get('picurl')
            }
          })
        };
        data.push({
          msgtype: 'text',
          touser,
          text: {content: this._getMediumSummaries(media)}
        });
        break;
      case 'image':
        data[0].image = {
          media_id: mediaJSON.wechatMediaId
        }
        if (mediaJSON.summary) {
          data.unshift({
            msgtype: 'text',
            touser,
            text: {content: mediaJSON.summary}
          });
        }
        if (mediaJSON.title) {
          data.unshift({
            msgtype: 'text',
            touser,
            text: {content: mediaJSON.title}
          })
        }
        break;
      default:
        data[0].text = {content: mediaJSON.summary};
        break;
    }

    if (mediaJSON.type !== 'text') {
      data.push({
        touser,
        msgtype: 'text',
        text: {content: this._getFollowingResponseForRecommend()}
      });
    }

    return data;
  }

  _getResDataFromScriptedRes(response, touser) {
    const contents = response.get('content');
    return contents.map(content => {
      const msgtype = content.msgtype,
            d = {
              touser,
              msgtype,
              [msgtype]: content.data
            };

      return d;
    });
  }

  _getFollowingResponseForRecommend() {
    const replies = [
      '这个觉得怎么样？',
      '这个合你口味吗？',
      '这个我觉得不错, 你觉得呢',
      'How about this? 喜欢吗？',
      '这个你应该有兴趣。'
      ],
      content = replies[getRandomInt(0, replies.length)];
    return content;
  }

  _getMediumSummaries(medium) {
    const filteredMedium = medium.filter(m => m.get('summary'));
    let content = '';
    if (filteredMedium.length === 1) {
      content = filteredMedium[0].get('summary');
    } else {
      filteredMedium.forEach((media, index) => {
        if (content) {
          content += ' ';
        }
        content += `${index + 1} ${media.get('summary')}`;
      });
    }
    return content;
  }

  _getRecommendedMediaId(userId) {
    const cql = `select * from Message where (senderId = '${userId}' or receiverId = '${userId}') order by createdAt DESC limit 0, 1000`;
    return leanCloud.AV.Query.doCloudQuery(cql)
      .then(data => {
        const mediaIds = data.results.reduce((memo, msg) => {
          const media = msg.get('media');
          if (media && media.id) {
            memo.push(media.id);
          }
          return memo;
        }, []);
        return mediaIds;
      });
  }
}

module.exports = Chatbot;
