var upnode = require('../../');
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
