'use strict';

const Chatbot = require('../lib/chatbot'),
      Message = require('../models/Message'),
      leanCloud = require('../lib/lean_cloud'),
      apiJSON = require('../lib/apiJSON');

const socket = (ws, req) => {
  ws.on('message', message => {
    const msgJSON = JSON.parse(message),
          token =  msgJSON.token;

    //console.log(msgJSON);

    let responseJSON;

    if (msgJSON.token) {
      const query = new leanCloud.AV.Query('_User');
      query.equalTo('token', token);
      query.first()
        .then(user => {
          switch(msgJSON.action) {
            case 'get':
              ws.send(JSON.stringify({
                action: msgJSON.action,
                data: []
              }));
              break;
            default: // POST
              if (!user) {
                throw new Error('current user does not exist');
              }

              const chatbot = new Chatbot(user);

              Message.save(msgJSON.data)
                .then(message => {
                  // Main logic to get the response for the message
                  return chatbot.onReceiveMessage(msgJSON.data.attributes.content);
                })
                .then(response => {
                  // Formatting
                  response.senderId = 'aili_bot';
                  response.receiverId = user.id;
                  responseJSON = apiJSON.format(response);
                  const userJSON = apiJSON.format({
                          nickname: 'Aili Bot',
                          headimgurl: 'http://66.media.tumblr.com/avatar_744356028720_128.png'
                        });
                  apiJSON.addRelatedResource(responseJSON, userJSON, 'user');

                  return Message.save(responseJSON);
                })
                .then(message => {
                  console.log(`response:`);
                  console.log(responseJSON);

                  ws.send(JSON.stringify({
                    action: msgJSON.action,
                    data: responseJSON
                  }));
                });
              break;
          }
        });
    }
  });
};

const _get = (req, res, next) => {
  const query = req.query;

  if (query.where) {
    query.where = JSON.parse(query.where);
  }
  /**
   * {
   *   orderBy: '',
   *   limit: '',
   *   where: {
   *     createdAt: {
   *       $lt: ''
   *     }
   *   }
   * }
   */
  let data = [];

  if (req.user) {
    Message.findByUserId(req.user.id, query)
      .then(messages => {
        data = messages.map(message => {
          return message.includeUserForJsonApi(req.user);
        });
        res.send({data});
      }, err => {
        console.log('err:', err);
      });
  } else {
    res.send({data});
  }
};

module.exports = {
  socket,
  get: _get
};
