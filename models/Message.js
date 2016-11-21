'use strict';

const leanCloud = require('../lib/lean_cloud'),
      _ = require('underscore'),
      BaseModel = require('./BaseModel'),
      apiJSON = require('../lib/apiJSON');

const LCMessage = leanCloud.AV.Object.extend('Message');

class Message extends BaseModel {
  constructor(lcObject) {
    super(lcObject);

    return this;
  }

  includeUserForJsonApi(user) {
    const msgJSON = apiJSON.format(this.toJSON()),
          userJSON = apiJSON.format(user.toJSON()),
          media = this.get('media');

    if (media && media.id) {
      apiJSON.addRelatedResource(msgJSON, {
        id: media.id,
        attributes: media.attributes
      }, 'media');
    }

    if (msgJSON.attributes.senderId === user.id) {
      apiJSON.addRelatedResource(msgJSON, userJSON, 'user');
    } else {
      apiJSON.addRelatedResource(msgJSON, {
        attributes: {
          nickname: 'Aili Bot',
          headimgurl: 'http://66.media.tumblr.com/avatar_744356028720_128.png'
        }
      }, 'user');
    }
    return msgJSON;
  }
}

Message.findByUserId = (userId, options) => {
  const op = {
    limit: 20,
    skip: 0
  };

  _.extend(op, options || {});

  let cql = `select include media, * from Message where (senderId = '${userId}' or receiverId = '${userId}') order by createdAt DESC limit ${op.skip}, ${op.limit}`;
  // hacky!
  if (op.where && op.where.createdAt) {
    cql = `select include media, * from Message where (senderId = '${userId}' or receiverId = '${userId}') and createdAt < date('${op.where.createdAt.$lt}') order by createdAt DESC limit ${op.skip}, ${op.limit}`;
  }

  console.log(`cql: ${cql}`);

  return leanCloud.AV.Query.doCloudQuery(cql)
    .then(data => {
      data = data.results.map(lcMessage => new Message(lcMessage));
      const messages = [];
      for (let i = data.length - 1;i >=0; i--) {
        messages.push(data[i]);
      }
      return messages;
    });
};

/**
 * @param  {Dict} data
 * {
 *   attributes: {
 *   },
 *   relationships: {
 *     media: {
 *       data: {
 *         id: ''
 *         attributes: {}
 *       }
 *     }
 *   }
 * }
 */
Message.save = (data) => {
  const lcMessage = new LCMessage();
  for (let key in data.attributes) {
    lcMessage.set(key, data.attributes[key]);
  }
  if (data.relationships && data.relationships.media) {
    const mediaId = data.relationships.media.data.id,
          media = leanCloud.AV.Object.createWithoutData('Media', mediaId);
    lcMessage.set('media', media);
  }

  return lcMessage.save().then(lcMessage => new Message(lcMessage));
};

module.exports = Message;
