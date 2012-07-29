# upnode

Keep a dnode connection alive and re-establish state between reconnects
with a transactional message queue.

[![build status](https://secure.travis-ci.org/substack/upnode.png)](http://travis-ci.org/substack/upnode)

# examples

## simple service interruption

server.js:

``` js
var upnode = require('upnode');

var server = upnode(function (client, conn) {
    this.time = function (cb) { cb(new Date().toString()) };
});
server.listen(7000);
```

Now when you want to make a call to the server, guard your connection in the
`up()` function. If the connection is alive the callback fires immediately.
If the connection is down the callback is buffered and fires when the connection
is ready again.

client.js:

``` js
var upnode = require('upnode');
var up = upnode.connect(7000);

setInterval(function () {
    up(function (remote) {
        remote.time(function (t) {
            console.log('time = ' + t);
        });
    });
}, 1000);
```

If we fire the client up first, then wait a few seconds to fire up the server:

```
$ node client.js & sleep 5; node server.js
[1] 9165
time = Fri Dec 16 2011 23:47:48 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:48 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:48 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:48 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:48 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:49 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:50 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:51 GMT-0800 (PST)
time = Fri Dec 16 2011 23:47:52 GMT-0800 (PST)
```

we can see that the first 5 seconds worth of requests are buffered and all come
through at `23:47:48`. The requests then come in one per second once the
connection has been established.

If we kill the server and bring it back again while the client is running we can
observe a similar discontinuity as all the pending requests come through at `23:50:20`:

```
$ node client.js 
time = Fri Dec 16 2011 23:50:11 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:11 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:12 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:13 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:20 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:21 GMT-0800 (PST)
time = Fri Dec 16 2011 23:50:22 GMT-0800 (PST)
```

## authenticated interruption

Oftentimes you'll want to re-establish state between reconnection attempts.

Suppose we have a simple dnode server with a `beep` function protected behind an
`auth` function:

server.js:

``` js
var upnode = require('upnode');

var server = upnode(function (client, conn) {
    this.auth = function (user, pass, cb) {
        if (user === 'moo' && pass === 'hax') {
            cb(null, {
                beep : function (fn) { fn('boop at ' + new Date) }
            });
        }
        else cb('ACCESS DENIED')
    };
});
server.listen(7000);
```

Now instead of doing `remote.auth()` every time the connection drops, we can
pass in a callback to `upnode.connect()` that will handle the re-authentication
and expose the authenticated object to the `up()` transaction:

client.js:

``` js
var upnode = require('upnode');
var up = upnode.connect(7000, function (remote, conn) {
    remote.auth('moo', 'hax', function (err, res) {
        if (err) console.error(err)
        else conn.emit('up', res)
    });
});

setInterval(function () {
    up(function (remote) {
        remote.beep(function (s) {
            console.log(s);
        });
    });
}, 1000);
```

Now spin up the client.js and the server.js:

```
$ node client.js & sleep 2; node server.js
[1] 10892
boop at Sat Dec 17 2011 01:30:15 GMT-0800 (PST)
boop at Sat Dec 17 2011 01:30:15 GMT-0800 (PST)
boop at Sat Dec 17 2011 01:30:16 GMT-0800 (PST)
boop at Sat Dec 17 2011 01:30:17 GMT-0800 (PST)
boop at Sat Dec 17 2011 01:30:18 GMT-0800 (PST)
```

Kill the server a few times and observe that the client re-authenticates between
reconnects.

You could do any other sort of stateful operation here besides authentication.
Just emit the object you want to expose to `up()` through
`conn.emit('up', obj)`.

## ssl stream example

This is very similar to the first example, except using tls streams. You can use
any kind of full-duplex stream here, not just ssl.

server.js:

``` js
var upnode = require('upnode');
var fs = require('fs');
var tls = require('tls');

var opts = {
    key : fs.readFileSync(__dirname + '/keys/key.pem'),
    cert : fs.readFileSync(__dirname + '/keys/cert.pem'),
};
var server = tls.createServer(opts, function (stream) {
    var up = upnode(function (client, conn) {
        this.time = function (cb) { cb(new Date().toString()) };
    });
    up.pipe(stream).pipe(up);
});
server.listen(7000);
```

client.js:

``` js
var upnode = require('upnode');
var tls = require('tls');
var up = upnode.connect({
    createStream : tls.connect.bind(null, 7000)
});

setInterval(function () {
    up(function (remote) {
        remote.time(function (t) {
            console.log('time = ' + t);
        });
    });
}, 1000);
```

It behaves just like the first example when run on the command line, except that
our connections go over ssl now:

```
$ node client.js & sleep 5; node server.js
[1] 9178
time = Sun Jul 29 2012 02:31:00 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:00 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:00 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:00 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:00 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:01 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:02 GMT-0700 (PDT)
time = Sun Jul 29 2012 02:31:03 GMT-0700 (PDT)
```

# methods

``` js
var upnode = require('upnode')
```

## var up = upnode(cons)

Create an upnode object `up` from the dnode constructor `cons`.

`up` is a pipe-able object, which is a useful property when writing custom
servers like in the ssl example.

In both server and client mode each side will send periodic heartbeats to the
other side and sever the connection if data isn't getting through. Clients
created with `up.connect()` will attempt to reconnect continuously.

# up.listen(...)

Listen on a port with `net.createServer()`.

To use something other than `net.createServer()`, exploit how `up` is a
full-duplex stream that you can pipe data into and out of.

Returns the net server object.

## var cup = up.connect(...)

Establish an upnode connection with `net.connect()`.

Pass in dnode-style arguments where port, host, path, and options objects are
inferred by the types of the arguments.

Returns a transaction function `up()` for the connection.

You can use other streams besides `net.connect()` streams by passing in a
`{ createStream : createStream }` object where `createStream()` is a function
that returns a new stream object. The connection will call `createStream()` when
the heartbeat fails or the previous stream ended or had errors.

The `cup` object emits `"up"` when the link is established, `"down" when the link
is severed, and `"reconnect"` for each reconnection attempt.

If you give `.connect()` a callback, you *must* emit an `'up', remote` event on
the `conn` object with the remote object you want to make available to the
subsequent `up()` transactions.

If you don't pass a callback to `.connect()` this default callback is used:

``` js
function (remote, conn) {
    conn.emit('up', remote);
}
```

The `conn` is just the dnode object.

The callback must emit an `'up'` event so that state can be rebuilt between
connection interruptions. A great use for this behavior is authentication where
certain functionality is only made available through the callback to a
`.auth(username, password, cb)` function on the remote. For that case you could
write a connection callback that looks like:

``` js
function (remote, conn) {
    remote.auth(user, pass, function (err, obj) {
        if (err) console.error(err)
        else conn.emit('up', obj)
    });
}
```

and your dnode sessions will be re-authenticated between reconnects. The remote
object handle in `up()` will be the `obj` result provided by the `auth()`
callback.

Besides being passed directly to dnode's `.connect(...)`, these additional
option-object arguments are respected:

* ping - Interval in milliseconds to send pings to the remote server.
    Default 10000. Set to 0 to disable pings.
* timeout - Time in milliseconds to wait for a ping response before triggering a
    reconnect. Default 5000.
* reconnect - Time in milliseconds to wait between reconnection attempts.
    Default 1000.
* createStream - Connection function to use instead of `net.connect()`.

## var cup = upnode.connect(...)

Shortcut for `upnode({}).connect(...)` like how `dnode.connect(...)` is a
shortcut for `dnode({}).connect(...)`.

## cup(timeout=0, cb)

Create a new transaction from the callback `cb`.

If the connection is ready, `cb(remote, conn)` will fire immediately.
Otherwise `cb` will be queued until the connection is available again.

If `timeout` is specified, fire `cb()` after `timeout` milliseconds with no
arguments. Here's an example of using timeouts:

``` js
up(5000, function (remote) {
    if (!remote) console.error('resource timed out')
    else remote.beep()
})
```

## cup.close()

Close the connection and don't attempt to reconnect.

# install

With [npm](http://npmjs.org) do:

```
npm install upnode
```

# license

MIT
