/* %Z% %W% %I% %E% %U% */
/*
 * <copyright
 * notice="lm-source-program"
 * pids="5755-P60"
 * years="2013,2014"
 * crc="3568777996" >
 * Licensed Materials - Property of IBM
 *
 * 5755-P60
 *
 * (C) Copyright IBM Corp. 2014
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with
 * IBM Corp.
 * </copyright>
 */


/** @const {string} enable unittest mode in mqlight.js */
process.env.NODE_ENV = 'unittest';

var mqlight = require('../mqlight');
var testCase = require('nodeunit').testCase;


/**
 * Test a calling client.subscribe(...) with too few arguments (no arguments)
 * causes an Error to be thrown.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_too_few_arguments = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    test.throws(function() {
      client.subscribe();
    });
    client.disconnect();
    test.done();
  });
};


/**
 * Test that calling client.subscribe(...) with too many arguments results in
 * the additional arguments being ignored.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_too_many_arguments = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    test.doesNotThrow(function() {
      client.subscribe('/foo', 'share1', {}, function() {}, 'stowaway');
    });
    client.disconnect();
    test.done();
  });
};


/**
 * Test that the callback argument to client.subscribe(...) must be a function
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_callback_must_be_function = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    test.throws(function() {
      client.subscribe('/foo', 'share', {}, 7);
    });
    test.doesNotThrow(function() {
      client.subscribe('/foo', function() {});
    });
    test.doesNotThrow(function() {
      client.subscribe('/foo', 'share', function() {});
    });
    test.doesNotThrow(function() {
      client.subscribe('/foo', 'share', {}, function() {});
    });
    client.disconnect();
    test.done();
  });
};


/**
 * Test that subscribe correctly interprets its parameters.  This can be
 * tricky for two and three parameter invocations where there is the
 * potential for ambiguity between what is a share name and what is the
 * options object.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_parameters = function(test) {
  var service = 'amqp://host:5672';
  var pattern = '/pattern';
  var currentCallbackInvocations = 0;
  var expectedCallbackInvocations = 0;
  var cb = function() {
    ++currentCallbackInvocations;
  };
  var share = 'share';
  var object = {};

  // Data to drive the test with. 'args' is the argument list to pass into
  // the subscribe function.  The 'share', 'object' and 'callback' properties
  // indicate the expected interpretation of 'args'.
  var data = [{args: [pattern]},
              {args: [pattern, cb], callback: cb},
              {args: [pattern, share], share: share},
              {args: [pattern, object], object: object},
              {args: [pattern, share, cb], share: share, callback: cb},
              {args: [pattern, object, cb], object: object, callback: cb},
              {args: [pattern, share, object], share: share, object: object},
              {args: [pattern, 7], share: 7},
              {args: [pattern, 'boo'], share: 'boo'},
              {args: [pattern, {}], object: {}},
              {args: [pattern, 7, cb], share: 7, callback: cb},
              {args: [pattern, {}, cb], object: {}, callback: cb},
              {args: [pattern, [], []], share: [], object: []},
              {args: [pattern, share, object, cb],
                share: share, object: object, callback: cb}];

  // Count up the expected number of callback invocations, so the test can
  // wait for these to complete.
  for (var i = 0; i < data.length; ++i) {
    if (data[i].callback) ++expectedCallbackInvocations;
  }

  // Replace the messeneger subscribe method with our own implementation
  // that simply records the address that mqlight.js tries to subscribe to.
  var lastSubscribedAddress;
  var savedSubscribe = mqlight.proton.messenger.subscribe;
  mqlight.proton.messenger.subscribe = function(address) {
    lastSubscribedAddress = address;
  };

  var client = mqlight.createClient({service: service});
  client.connect(function() {
    for (var i = 0; i < data.length; ++i) {
      var clientSubscribeMethod = client.subscribe;
      lastSubscribedAddress = undefined;
      clientSubscribeMethod.apply(client, data[i].args);

      var expectedAddress =
          service + '/' +
          ((data[i].share) ? ('share:' + data[i].share + ':') : 'private:') +
          pattern;

      test.deepEqual(lastSubscribedAddress, expectedAddress);
    }

    // Restore the saved messenger subscribe implementation
    mqlight.proton.messenger.subscribe = savedSubscribe;
    client.disconnect();

  });

  // Callbacks passed into subscribe(...) are scheduled to be run once
  // outside of the main loop - so use setImmediate(...) to schedule checking
  // for test completion.
  var testIsDone = function() {
    if (currentCallbackInvocations === expectedCallbackInvocations) {
      test.done();
    } else {
      setImmediate(testIsDone);
    }
  };
  testIsDone();
};


/**
 * Test that the callback (invoked when the subscribe operation completes
 * successfully) specifies the right number of arguments, and is invoked with
 * 'this' set to reference the client that the corresponding invocation of
 * subscribe(...) was made against.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_ok_callback = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    client.subscribe('/foo', function() {
      test.equals(arguments.length, 2);  // Is this correct? See defect 61003
      test.ok(this === client);
      client.disconnect();
      test.done();
    });
  });
};


/**
 * Test that the callback (invoked when the subscribe operation completes
 * unsuccessfully) specifies the right number of arguments, and is invoked
 * with 'this' set to reference the client that the corresponding invocation
 * of subscribe(...) was made against.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_fail_callback = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  var count = 0;

  // Replace the messeneger subscribe method with our own implementation.
  var savedSubscribe = mqlight.proton.messenger.subscribe;
  mqlight.proton.messenger.subscribe = function(address) {
    throw new Error('topic space on fire');
  };

  client.connect(function() {
    client.subscribe('/foo', function(err) {
      test.ok(err instanceof Error);
      test.equals(arguments.length, 2);  // Is this correct? See defect 61003
      test.ok(this === client);

      client.disconnect();
      mqlight.proton.messenger.subscribe = savedSubscribe;
      if (++count == 2) test.done();
    });
  });

  client.on('error', function(err) {
    test.ok(err instanceof Error);
    test.equals(arguments.length, 1);
    test.ok(this === client);
    if (++count == 2) test.done();
  });
};


/**
 * Test that trying to establish a subscription, while the client is in
 * disconnected state, throws an Error.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_when_disconnected = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  test.throws(function() {
    client.subscrinbe('/foo');
  }, Error);
  test.done();
};


/**
 * Test that calling the subscribe(...) method returns, as a value, the client
 * object that the method was invoked on (for method chaining purposes).
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_returns_client = function(test) {
  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    test.deepEqual(client.subscribe('/foo'), client);
    client.disconnect();
    test.done();
  });
};


/**
 * Test a variety of valid and invalid patterns.  Invalid patterns
 * should result in the client.subscribe(...) method throwing a TypeError.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_topics = function(test) {
  var data = [{valid: false, pattern: ''},
              {valid: false, pattern: undefined},
              {valid: false, pattern: null},
              {valid: true, pattern: 1234},
              {valid: true, pattern: function() {}},
              {valid: true, pattern: 'kittens'},
              {valid: true, pattern: '/kittens'},
              {valid: true, pattern: '+'},
              {valid: true, pattern: '#'},
              {valid: true, pattern: '/#'},
              {valid: true, pattern: '/+'}];

  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    for (var i = 0; i < data.length; ++i) {
      if (data[i].valid) {
        test.doesNotThrow(function() {
          client.subscribe(data[i].pattern);
        });
      } else {
        test.throws(function() {
          client.subscribe(data[i].pattern);
        }, TypeError, 'pattern should have been rejected: ' + data[i].pattern);
      }
    }
    client.disconnect();
    test.done();
  });
};


/**
 * Tests a variety of valid and invalid share names to check that they are
 * accepted or rejected (by throwing an Error) as appropriate.
 * @param {object} test the unittest interface
 */
module.exports.test_subscribe_share_names = function(test) {
  var data = [{valid: true, share: 'abc'},
              {valid: true, share: 7},
              {valid: false, share: ':'},
              {vaild: false, share: 'a:'},
              {valid: false, share: ':a'}];

  var client = mqlight.createClient({service: 'amqp://host'});
  client.connect(function() {
    for (var i = 0; i < data.length; ++i) {
      if (data[i].valid) {
        test.doesNotThrow(function() {
          client.subscribe('/foo', data[i].share);
        });
      } else {
        test.throws(function() {
          client.subscribe('/foo', data[i].share);
        }, Error, i);
      }
    }
    client.disconnect();
    test.done();
  });
};