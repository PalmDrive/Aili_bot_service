'use strict';

const leanCloud = require('../lib/lean_cloud'),
      LCUser = leanCloud.AV.Object.extend('_User');

class User {
  constructor () {

  }
}

User.login = leanCloud.AV.User.login;

module.exports = User;
