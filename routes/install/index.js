var express = require('express');
var fs = require('fs');
var hbs = require('hbs');
var path = require('path');
var validator = require('validator');
var origin = require('../../');
var configuration = require('../../lib/configuration');
var logger = require('../../lib/logger');
var database = require('../../lib/database');
var permissions = require('../../lib/permissions');
var tenantmanager = require('../../lib/tenantmanager');
var localAuth = require('../../plugins/auth/local');
var crypto = require('crypto');
var fs = require('fs');
var installer = module.exports = express();

var GIT_FRAMEWORK_CLONE_URL = 'https://github.com/adaptlearning/adapt_framework.git';

// set up handlebars form helpers
require('handlebars-form-helpers').register(hbs.handlebars);

installer.set('views', __dirname);
installer.set('view engine', 'hbs');

// register partials from our ./partials directory
hbs.registerPartials(path.join(__dirname, 'partials'));

function randomValueBase64 (len) {
    return crypto.randomBytes(Math.ceil(len * 3 / 4))
        .toString('base64')   // convert to base64 format
        .slice(0, len)        // return required number of characters
        .replace(/\+/g, '0')  // replace '+' with '0'
        .replace(/\//g, '0'); // replace '/' with '0'
}

// prevent installer running if config is not setup
installer.all('/install*', function (req, res, next) {
  // check if install has completed, redirect to root if so
    if (configuration.getConfig('configLoaded')) {
      return res.redirect('/');
    }
    return next();
});

// installer landing page
installer.all('/install', function (req, res, next) {
  res.render('install', {pageTitle: "Install"});

});

// ffmpeg check/info page
installer.all('/install/ffmpeg', function (req, res, next) {
  if (req.body.submit) {
    var ffInstall = false;
    ffInstall = (req.body.ffmpeg === "true") || false;
    configuration.setConfig('useffmpeg', ffInstall);
    res.redirect('/install/framework');
  }
  res.render('ffmpeg', {pageTitle: "FFmpeg"});
});

// server configuration page
installer.all('/install/server', function (req, res, next) {
  var app = origin();
  var serverName = req.body.serverName || 'localhost';
  var serverPort = req.body.serverPort || app.defaults.DEFAULT_SERVER_PORT;
  var errors = {};

  if (req.body.submit) {
    if (!(validator.isURL(serverName) || validator.isIP(serverName))) {
      errors.serverName = errors.serverName || [];
      errors.serverName.push('server name must be a valid hostname or ip address');
    }

    if (!validator.isNumeric(serverPort) || validator.isNull(String(serverPort))) {
      errors.serverPort = errors.serverPort || [];
      errors.serverPort.push('server port must be a numeric value!');
    }

    if (0 === Object.keys(errors).length) {
      configuration.setConfig('serverName', serverName);
      configuration.setConfig('serverPort', serverPort);
      res.redirect('/install/database');
    }
  }

  res.render('server', {
    'pageTitle': 'Configure Server',
    'serverName': serverName,
    'serverPort': serverPort,
    'errors': errors
  });
});

// database configuration page
installer.all('/install/database', function (req, res, next) {
  // need to know what drivers are available on the system
  database.getAvailableDrivers(function (error, drivers) {
    if (error) {
      return res.json(error);
    }

    var dbType = req.body.dbType || 'mongoose';
    var dbHost = req.body.dbHost || 'localhost';
    var dbPort = req.body.dbPort || 27017;
    var dbUser = req.body.dbUser || '';
    var dbPass = req.body.dbPass || '';
    var sessionSecret = req.body.sessionSecret || randomValueBase64(32);
    var errors = {};

    if (req.body.submit) {
      if (-1 === drivers.indexOf(dbType)) {
        errors.dbType = errors.dbType || [];
        errors.dbType.push('database driver must be one of the following: ' + drivers.join(','));
      }

      if (!(validator.isURL(dbHost) || validator.isIP(dbHost))) {
        errors.dbHost = errors.dbHost || [];
        errors.dbHost.push('database host must be a valid ip address or url');
      }

      if (!validator.isNumeric(dbPort)) {
        errors.dbPort = errors.dbPort || [];
        errors.dbPort.push('database port must be a valid port number');
      }

      if (validator.isNull(validator.trim(sessionSecret))) {
        errors.sessionSecret = errors.sessionSecret || [];
        errors.sessionSecret.push('session secret cannot be empty!');
      }

      if (0 === Object.keys(errors).length) {
        configuration.setConfig('dbType', dbType);
        configuration.setConfig('dbHost', dbHost);
        configuration.setConfig('dbPort', dbPort);
        configuration.setConfig('dbUser', dbUser);
        configuration.setConfig('dbPass', dbPass);
        configuration.setConfig('sessionSecret', sessionSecret);
        res.redirect('/install/tenant');
      }
    }

    res.render('database', {
      'pageTitle': 'Configure Database',
      'drivers': drivers,
      'dbType': dbType,
      'dbHost': dbHost,
      'dbPort': dbPort,
      'dbUser': dbUser,
      'dbPass': dbPass,
      'sessionSecret' : sessionSecret,
      'errors': errors
    });
  });
});

// Framework clone page
installer.all('/install/framework', function(req, res, next) {

  if (req.body.submit) {
    return res.redirect('/install/server');
  }

  // return;

  res.render('framework', {
    'pageTitle': "Installing Adapt framework",
    'formAction': '/install/framework'
  });
});

// master tenant creation page
installer.all('/install/tenant', function (req, res, next) {
  var tenantPrefix = req.body.tenantPrefix || 'adapt-tenant-';
  var tenantName = req.body.tenantName || 'master';
  var adminEmail = req.body.adminEmail || '';
  var adminPass = req.body.adminPass || '';
  var errors = {};

  if (req.body.submit) {
    if (validator.isNull(validator.trim(tenantPrefix))) {
      errors.tenantPrefix = errors.tenantPrefix || [];
      errors.tenantPrefix.push('tenant prefix must not be empty!');
    }

    if (validator.isNull(validator.trim(tenantName))) {
      errors.tenantName = errors.tenantName || [];
      errors.tenantName.push('tenant name must not be empty!');
    }

    if (!validator.isEmail(adminEmail)) {
      errors.adminEmail = errors.adminEmail || [];
      errors.adminEmail.push('administrator email must be a valid email!');
    }

    if (validator.isNull(validator.trim(adminPass))) {
      errors.adminPass = errors.adminPass || [];
      errors.adminPass.push('admin password must not be empty!');
    }

    if (0 === Object.keys(errors).length) {
      configuration.setConfig('tenantPrefix', tenantPrefix);
      configuration.setConfig('dbName', tenantPrefix + tenantName);

      // ensure database connection is up
      database.getDatabase(function (error, db) {
        if (error) {
          return res.json(error);
        }

        // add tenant!
        tenantmanager.createTenant({name: tenantName}, function (error, tenant) {
          if (error) {
            return next(error);
          }

          // add a new user using default auth plugin
          new localAuth().internalRegisterUser({
              email: adminEmail,
              password: adminPass,
              _tenantId: tenant._id
            }, function (error, user) {
              if (error) {
                return next(error);
              }

              // admin user requires access to all areas!
              permissions.createPolicy(user._id, function (error, policy) {
                // add a new policy statement
                permissions.addStatement(policy, ['create', 'read', 'update', 'delete'], permissions.buildResourceString('*', '/*'), 'allow', function (error) {
                  if (error) {
                    return next(error);
                  }

                  // all ready to go!
                  return res.redirect('/install/complete')
                });
              });
            }
          );
        });
      });

      // no errors means wait for callback
      return;
    }
  }

  // render the form
  res.render('tenant', {
    'pageTitle': "Configure Default Tenant",
    'formAction': '/install/tenant',
    'tenantPrefix': tenantPrefix,
    'tenantName': tenantName,
    'adminEmail': adminEmail,
    'adminPass': adminPass,
    'errors': errors
  });

});

// installation complete
installer.get('/install/complete', function (req, res, next) {
  // by default, auth is local
  configuration.setConfig('auth', 'local');
  configuration.setConfig('dataRoot', 'data');
  configuration.setConfig('configLoaded', "true");

  // write the configuration file
  var app = origin();
  app.configuration = configuration;
  // must close connection!
  res.header('Connection', 'close');
  res.render('complete', {
    'pageTitle': 'Installation Complete!',
    'dashboard': app.getServerURL()
  });

  // restart server, NB: we reload the config file to be sure that it was correctly written
  // (we use console.log here instead of logger, since logger may not be correctly configured)
  configuration.load(function (e) {e && console.log(e);});
  configuration.once('change:config', function () {
    // skip grunt build
    return app.restartServer();
  });

});

