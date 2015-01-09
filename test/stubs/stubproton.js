/* %Z% %W% %I% %E% %U% */
/*
 * <copyright
 * notice="lm-source-program"
 * pids="5725-P60"
 * years="2013,2014"
 * crc="3568777996" >
 * Licensed Materials - Property of IBM
 *
 * 5725-P60
 *
 * (C) Copyright IBM Corp. 2014
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with
 * IBM Corp.
 * </copyright>
 */
/* jslint node: true */
/* jshint -W083,-W097 */
'use strict';

var util = require('util');
var Duplex = require('stream').Duplex;

var DEBUG = process.env.MQLIGHT_NODE_STUB_DEBUG || false;
var log = process.env.MQLIGHT_NODE_STUB_LOG_ERROR ? console.error : console.log;

var connectStatus = 0;


/**
 * Override the proton connection status.
 *
 * @param {string} status Specifies the status to override with.
 */
exports.setConnectStatus = function(status) {
  if (DEBUG) log('setting connect status to: ' + status);
  connectStatus = status;
};

var sendStatus = 7; // PN_STATUS_SETTLED = 7


/**
 * Temporarily blocks message sends from completing by forcing the status to
 * return as PN_STATUS_PENDING.
 */
exports.blockSendCompletion = function() {
  if (DEBUG) log('blocking send completion');
  sendStatus = 1; // PN_STATUS_PENDING = 1
};


/**
 * Removes a block on message sends by forcing the status to PN_STATUS_SETTLED.
 */
exports.unblockSendCompletion = function() {
  if (DEBUG) log('unblocking send completion');
  sendStatus = 7;
};

var remoteIdleTimeout = -1;
var workCallback;


/**
 * Sets a remoteIdleTimeout value to return.
 *
 * @param {Number}
 *          interval the value to override the remote idle timeout
 *          property with.
 * @param {function} callback
 */
exports.setRemoteIdleTimeout = function(interval, callback) {
  if (DEBUG) log('setRemoteIdleTimeout to ' + interval);
  remoteIdleTimeout = interval;
  workCallback = callback;
};


/**
 * A no-function stub for the native Proton code.
 *
 * @return {object} a stub for the proton module.
 */
module.exports.createProtonStub = function() {

  return {
    messenger: {
      send: function() {
        if (DEBUG) log('stub send function called');
      },
      status: function(msg) {
        var result = sendStatus;
        if (result === 7 && msg.unitTestQos === 0) {
          result = 0;
        }
        if (DEBUG) log('stub status function called, returning: ', result);
        return result;
      },
      statusError: function() {
        if (DEBUG) log('stub statusError function called');
        return '';
      },
      accept: function() {
        if (DEBUG) log('stub accept function called');
      },
      settle: function() {
        if (DEBUG) log('stub settle function called');
      },
      settledCount: 0,
      settled: function() {
        if (DEBUG) log('stub settled function called');
        if (connectStatus !== 0) {
          var err = new Error('error on settle: ' + connectStatus);
          err.name = 'NetworkError';
          throw err;
        } else {
          if (++this.settledCount >= 2) {
            return true;
          } else {
            return false;
          }
        }
      },
      connect: function(service, sslTrustCertificate, sslVerifyName) {
        if (DEBUG) log('stub connect function called for service: ' +
                       service, sslTrustCertificate, sslVerifyName);
        if (!this.stopped) throw new Error('already connected');
        var href = service.href;
        var err = null;
        if (href.indexOf('bad') != -1) {
          err = new TypeError('bad service ' + href);
        } else if (sslTrustCertificate === 'BadCertificate') {
          err = new Error('Bad Certificate');
          err.name = 'SecurityError';
        } else if (sslTrustCertificate === 'BadVerify' && sslVerifyName) {
          err = new Error('Bad verify name');
          err.name = 'SecurityError';
        } else {
          if (connectStatus !== 0) {
            err = new Error('connect error: ' + connectStatus);
            err.name = 'NetworkError';
          } else {
            err = null;
            this.stopped = false;
            if (DEBUG) log('successfully connected');
          }
        }
        if (err) throw err;
      },
      receive: function() {
        // Commented - as generates a lot of output...
        // if (DEBUG) log('stub receive function called');
        return [];
      },
      stopCount: 2,
      stop: function() {
        if (DEBUG) log('stub stop function called');
        if (!this.stopped) {
          this.stopCount--;
          if (this.stopCount === 0) {
            this.stopped = true;
            this.stopCount = 2;
          }
        }
        if (DEBUG) log('stub stop function returning: '+this.stopped);
        return this.stopped;
      },
      put: function(msg, qos) {
        if (DEBUG) log('stub put function called');
        msg.unitTestQos = qos;
      },
      hasSent: function() {
        if (DEBUG) log('stub hasSent function called');
        return true;
      },
      started: true,
      stopped: true,
      subscribe: function() {
        if (DEBUG) log('stub subscribe function called');
      },
      subscribedCount: 0,
      subscribed: function(address) {
        if (DEBUG) log('stub subscribed function called with address ' +
                       address);
        if (connectStatus !== 0) {
          var err = new Error('error on subscribe: ' + connectStatus);
          err.name = 'NetworkError';
          throw err;
        } else {
          if (++this.subscribedCount >= 2) {
            this.subscribedCount = 0;
            return true;
          } else {
            return false;
          }
        }
      },
      unsubscribe: function() {
        if (DEBUG) log('stub unsubscribe function called');
      },
      unsubscribedCount: 0,
      unsubscribed: function(address) {
        if (DEBUG) log('stub unsubscribed function called with ' +
                       'address ' + address);
        if (connectStatus !== 0) {
          var err = new Error('error on unsubscribe: ' + connectStatus);
          err.name = 'NetworkError';
          throw err;
        } else {
          if (++this.unsubscribedCount >= 2) {
            this.unsubscribedCount = 0;
            return true;
          } else {
            return false;
          }
        }
      },
      getRemoteIdleTimeout: function(address) {
        if (DEBUG) log('stub getRemoteIdleTimeout function called, ' +
                       'returning: ' + remoteIdleTimeout);
        return remoteIdleTimeout;
      },
      flow: function(linkAddress, credit) {
        if (DEBUG) log('stub flow function called with link address: ' +
                       linkAddress + ' and credit: ' + credit);
      },
      pendingOutbound: function(address) {
        if (DEBUG) log('pendingOutbound function called with address ' +
                       address);
        return false;
      },
      push: function(length, chunk) {
        var result = Math.floor(Math.random() * (length+1));
        if (DEBUG) log('stub push function called, returning:', result);
        return result;
      },
      pop: function(stream, force) {
        if (DEBUG) log('stub pop function called');
        if (force) {
          if (workCallback) workCallback.apply();
        }
        return 0;
      },
      closed: function() {
        if (DEBUG) log('stub closed function called');
        return 0;
      }
    },

    createMessenger: function() {
      if (DEBUG) log('stub createMessenger function called');
      connectStatus = 0;
      this.messenger.stopped = true;
      return this.messenger;
    },

    createMessage: function() {
      if (DEBUG) log('stub createMessage function called');
      return {
        destroy: function() {
          if (DEBUG) log('stub destroy function called');
        }
      };
    },

    connect: function(options, callback) {
      if (DEBUG) log('stub proton connect function called');
      process.nextTick(function() {
        callback.apply(this, []);
      });
      return new StubStream();
    }
  };
};

/**
 * A stub connection to the Server implemented as a Duplex
 * Stream.
 *
 * @constructor
 * @param {object} options stream options.
 * @return {object} a stub connection.
 */

var StubStream = function(options) {
  if (DEBUG) log('StubStream constructor called');

  if (!(this instanceof StubStream))
    return new StubStream(options);

  Duplex.call(this, options);

  this.ended = false;
  this.authorized = true;

  this._read = function(size) {
    if (DEBUG) log('stream _read function called for size:', size);
  };

  this._write = function(chunk, encoding, callback) {
    if (DEBUG) log('stream _write function called for chunk size:',
                   chunk.length);
  };

  this.end = function() {
    if (DEBUG) log('stream end function called');
    this.ended = true;
    this.push(null);
  };

  var pushData = function(stream) {
    if (!stream.ended) {
      stream.push('chunk');
      setImmediate(function() {
        pushData(stream);
      });
    }
  };

  setImmediate(function(stream) {
    pushData(stream)
  }, this);
};
util.inherits(StubStream, Duplex);
