'use strict';

const express = require('express'),
      path = require('path'),
      logger = require('morgan'),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      leanCloud = require('./lib/lean_cloud');

// Set the app root path
global.APP_ROOT = path.resolve(__dirname);
global.APP_ENV = process.env.NODE_ENV || 'development';

const Errors = require('./lib/errors'),
      BadRequestError = require('./lib/errors/BadRequestError'),
      NotFoundError = require('./lib/errors/NotFoundError'),
      UnauthorizedError = require('./lib/errors/UnauthorizedError');

const config = require(`./config/${global.APP_ENV}.json`),
    app = express(),
    apiRouter = express.Router(),
    expressWs = require('express-ws')(app);


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
const messagesCtrl = require('./controllers/messagesController');
      //usersCtrl = require('./controllers/usersController');

apiRouter.ws('/messages', messagesCtrl.socket);
apiRouter.get('/messages', messagesCtrl.get);
// apiRouter.post('/users/login', usersCtrl.login);
// apiRouter.post('/users', usersCtrl.signup);

app.use('/api', apiRouter);

// error handler for all the application
app.use(function(err, req, res, next) {
  console.log("Catching error: ", err);

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

  console.log('error message: ');
  console.log(errors[0].message);

  return res.status(code).json({
    errors: errors
  });
});

module.exports = app;
