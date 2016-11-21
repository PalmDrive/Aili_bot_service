'use strict';

const apiJSON = require('./apiJSON'),
      uuid = require('node-uuid'),
      leanCloud = require('./lean_cloud');

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

const mediaTypeToMsgType = {
  article: 1,
  audio: 2,
  video: 3
};

class Chatbot {
  constructor(user) {
    this.currentUser = user;
    return this;
  }

  // @return {Promise} response
  onReceiveMessage(queryStr) {
    const result = this.getIntent(queryStr);
    return this[result.action](result.parameters);
  }

  _getRecommendedMediaId() {
    const cql = `select * from Message where (senderId = '${this.currentUser.id}' or receiverId = '${this.currentUser.id}') order by createdAt DESC limit 0, 1000`;
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
                  type: mediaTypeToMsgType[media.get('type')]
                };

          apiJSON.addRelatedResource(response, {
            id: media.id,
            attributes: media.toJSON()
          }, 'media');

          return response;
        } else {
          return {
            type: 0,
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
        type: 0,
        content: '你好, 我是Aili。我每天会为你挑选你感兴趣的有意思内容。'
      });
    });
  }

  getRandomReply() {
    const replies = ['你真棒!', '真的嘛?', '然后呢~', '嗯嗯', '不想理你了'],
          content = replies[getRandomInt(0, replies.length)];

    return new Promise(resolve => {
      resolve({
        type: 0,
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
}

module.exports = Chatbot;
