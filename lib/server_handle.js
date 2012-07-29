var dnode = require('dnode');

module.exports = function (server, cons) {
    return handle.bind(null, server, cons);
};

function handle (server, cons, stream) {
    var d = dnode(cons);
    d.stream = stream;
    d.pipe(stream).pipe(d);
    
    d.on('local', function (local) {
        if (local.ping === undefined) {
            local.ping = function (cb) {
                if (typeof cb === 'function') cb();
            };
        }
    });
    
    d.on('remote', function (remote) {
        var iv = setInterval(function () {
            if (typeof remote.ping === 'function') {
                var to = setTimeout(function () {
                    d.end();
                }, 10 * 10000);
                
                remote.ping(function () {
                    clearTimeout(to);
                });
            }
        }, 10 * 1000);
        
        var onend = function () {
            stream.destroy();
            clearInterval(iv);
            var ix = server._ds.indexOf(d);
            if (ix >= 0) server._ds.splice(ix, 1);
        };
        
        if (!server._ds) server._ds = [];
        server._ds.push(d);
        
        stream.once('end', onend);
        stream.once('disconnect', onend);
        stream.once('close', onend);
        stream.once('error', onend);
    });
}
