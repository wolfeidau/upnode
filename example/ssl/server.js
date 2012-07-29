var upnode = require('../../');
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
