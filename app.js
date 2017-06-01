'use strict';

const express = require('express'),
      path = require('path'),
      logger = require('morgan'),
      bodyParser = require('body-parser'),
      xmlParser = require('express-xml-bodyparser'),
      cors = require('cors'),
      leanCloud = require('./lib/lean_cloud');

// Set the app root path
global.APP_ROOT = path.resolve(__dirname);
global.APP_ENV = process.env.NODE_ENV || 'develop';

const Errors = require('./lib/errors'),
      BadRequestError = require('./lib/errors/BadRequestError'),
      NotFoundError = require('./lib/errors/NotFoundError'),
      UnauthorizedError = require('./lib/errors/UnauthorizedError');

const app = express(),
    apiRouter = express.Router(),
    expressWs = require('express-ws')(app);

const _hasXMLInRequest = (req) => {
  const str = req.headers['content-type'] || '',
        regexp = /^(text\/xml|application\/([\w!#\$%&\*`\-\.\^~]+\+)?xml)$/i;

  return regexp.test(str.split(';')[0]);
}

app.use(logger('dev'));

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: false}));
app.use(cors());

/**
 * Check 'x-ailibot-key' in the headers in every routes in the apiApp
 * The public key is used to identifies the request came from the trusted client
 */
// app.use(function(req, res, next) {
//   if (req.headers['x-ailibot-key'] === config.appPublicKey) {
//     next();
//   } else {
//     let err = new UnauthorizedError('401', {message: 'invalid x-ailibot-key'});

//     return res.status(err.status).json({
//       errors: [err.inner]
//     });
//   }
// });
// Auth and get current user
app.use((req, res, next) => {
  const token = req.headers['x-ailibot-token'];
  console.log('token:', token);
  if (token) {
    const query = new leanCloud.AV.Query('_User');
    query.equalTo('token', token);
    query.first()
      .then(user => {
        req.user = user;
        next();
      });
  } else {
    next();
  }
});

// Messages controller
const messagesCtrl = require('./controllers/messagesController'),
      wechatMessagesCtrl = require('./controllers/wechatMessagesController');

apiRouter.ws('/messages', messagesCtrl.socket);
apiRouter.get('/messages', messagesCtrl.get);
// apiRouter.post('/users/login', usersCtrl.login);
// apiRouter.post('/users', usersCtrl.signup);

// Wechat messages controller
apiRouter.post(
  '/wechat/:clientId/messages', (req, res, next) => {
    const query = new leanCloud.AV.Query('Client'),
          errMsg = `Client with id ${req.params.clientId} not found`;
    query.get(req.params.clientId)
      .then(client => {
        if (client) {
          req.client = client;
          next();
        } else {
          next(new NotFoundError('404', {message: errMsg}));
        }
      })
      .catch(err => next(new BadRequestError('400', {message: err.message})));
  },
  xmlParser({trim: false, explicitArray: false}),
  wechatMessagesCtrl.post
);
// For Wechat api endpoint verification
apiRouter.get('/wechat/:clientId/messages', wechatMessagesCtrl.get);

app.use('/api', apiRouter);

// error handler for all the application
app.use(function(err, req, res, next) {
  console.log("Catching error: ", err.stack || err);

  let code = 400,
      msg = { message: 'Internal Server Error' },
      errors;

  if (!Errors.isDefined(err)) {
    err = new BadRequestError('400', err);
  }

  if (err.name) {
    code = err.status;
    //msg = err.inner || { message: err.message };
    msg = { message: err.message };
  }

  errors = [msg];

  // Handle SequelizeUniqueConstraintError
  if (err.inner && err.inner.name === 'SequelizeUniqueConstraintError') {
    errors = err.inner.errors;
  }

  console.log('error message: ', errors[0].message);

  return res.status(code).json({
    errors: errors
  });
});

// Start worker
const Flipboard = require('./lib/flipboard'),
      fp = new Flipboard();
fp.initWorker();

// const mediaQuery = new leanCloud.AV.Query('Media'),
//       bosonnlp = require('./lib/bosonnlp');
// mediaQuery.equalTo('source', 'Flipboard');
// mediaQuery.doesNotExist('summary');
// mediaQuery.equalTo('type', 'article');

// mediaQuery.find()
//   .then(medium => Flipboard.setMediaSummaryAndKeywords(medium))
//   .then(medium => leanCloud.AV.Object.saveAll(medium))
//   .catch(err => console.error('err:', err.stack || err));

module.exports = app;
