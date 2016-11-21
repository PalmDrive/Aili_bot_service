'use strict';

const leanCloud = require('../lib/lean_cloud');

const signup = (req, res, next) => {
  const data = req.body.data;

  const user = new leanCloud.AV.User();
  user.setUsername(data.username);
  // hardcode password for now
  user.setPassword('p@ssword#1');
};

const login = (req, res, next) => {

};

module.exports = {
  signup,
  login
};


// 新建 AVUser 对象实例
  var user = new AV.User();
  // 设置用户名
  user.setUsername('Tom');
  // 设置密码
  user.setPassword('cat!@#123');
  // 设置邮箱
  user.setEmail('tom@leancloud.cn');
  user.signUp().then(function (loginedUser) {
      console.log(loginedUser);
  }, function (error) {
  });
