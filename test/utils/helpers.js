'use strict';

const leanCloud = require('../../lib/lean_cloud');

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
    link: 'nolink',
    isActive: true
  };
  return leanCloud.createObjectWithData('Media', data);
};

const removeClient = () => {
  const query = new leanCloud.AV.Query('Client');
  return leanCloud.batchDestroy(query);
};

const removeMedia = () => {
  const query = new leanCloud.AV.Query('Media');
  return leanCloud.batchDestroy(query);
};

const removeUser = () => {
  const query = new leanCloud.AV.Query('WeChatUser');
  return leanCloud.batchDestroy(query);
};

module.exports = {
  createMedia,
  createUser,
  createClient,
  removeClient,
  removeMedia,
  removeUser
};
