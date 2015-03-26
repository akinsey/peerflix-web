var Hapi = require('hapi');
var Boom = require('boom');
var Good = require('good');
var GoodFile = require('good-file');
var GoodConsole = require('good-console');
var ip = require('ip');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var path = require('path');
var tempDir = require('os').tmpdir();
var readTorrent = require('read-torrent');
var uuid = require('node-uuid');
var fs = require('fs');
var kickass = require('kickass-torrent');
var peerflix = require('peerflix');
var omx = require('omxctrl');

// Configs
var PORT = process.argv[2] || 8080;
var LOG_ENABLED = true;

// Params
var connection;
var states = ['Playing', 'Paused', 'Idle'];
var omxCtrlMap = {
  'pause': 'pause',
  'speedup': 'increaseSpeed',
  'speeddown': 'decreaseSpeed',
  'nextaudio': 'nextAudioStream',
  'prevaudio': 'previousAudioStream',
  'nextsubtitle': 'nextSubtitleStream',
  'prevsubtitle': 'previousSubtitleStream',
  'togglesubtitle': 'toggleSubtitles',
  'volumeup': 'increaseVolume',
  'volumedown': 'decreaseVolume',
  'forward': 'seekForward',
  'backward': 'seekBackward',
  'fastforward': 'seekFastForward',
  'fastbackward': 'seekFastBackward'
};

// Helper Methods
var clearTorrentCache = function() {
  fs.readdir(tempDir, function(err, files) {
    if (err) {
      console.log(err);
      return;
    }
    files.forEach(function(file) {
      if (file.substr(0, 9) === 'peerflix-') {
        rimraf.sync(path.join(tempDir, file));
      }
    });
  });
};

var stop = function() {
  if (!connection) { return; }
  connection.destroy();
  connection = null;
  omx.stop();
  clearTorrentCache();
};

omx.on('ended', function() {
  stop();
});

// Server Setup
var server = new Hapi.Server();
server.connection({ port: PORT });

if (LOG_ENABLED) {
  var options = { logRequestPayload: true };
  var opsPath = path.normalize(__dirname +  '/logs/operations');
  var errsPath = path.normalize(__dirname + '/logs/errors');
  var reqsPath = path.normalize(__dirname + '/logs/requests');
  mkdirp.sync(opsPath);
  mkdirp.sync(errsPath);
  mkdirp.sync(reqsPath);
  var configWithPath = function(path) {
    return { path: path, extension: 'log', rotate: 'daily', format: 'YYYY-MM-DD-X', prefix:'peerflix-web' };
  };
  var consoleReporter = new GoodConsole({ log: '*', response: '*' });
  var opsReporter = new GoodFile(configWithPath(opsPath), { log: '*', ops: '*' });
  var errsReporter = new GoodFile(configWithPath(errsPath), { log: '*', error: '*' });
  var reqsReporter = new GoodFile(configWithPath(reqsPath), { log: '*', response: '*' });
  options.reporters = [ consoleReporter, opsReporter, errsReporter, reqsReporter ];
  server.register({ register: Good, options: options}, function(err) { if (err) { throw(err); } });
}

server.start(function () {
  clearTorrentCache();
  console.log('Peerflix web running at: http://' + ip.address() + ':' + server.info.port);
});

// Routes
server.route({
  method: 'GET',
  path: '/',
  handler: function (request, reply) {
    reply.file(path.join(__dirname, '/index.html'));
  }
});

server.route({
  method: 'POST',
  path: '/play',
  handler: function (request, reply) {
    var torrentUrl = request.payload.url;
    if (torrentUrl) {
      readTorrent(torrentUrl, function(err, torrent) {
        if (err) { return reply(Boom.badRequest(err)); }
        if (connection) { stop(); }

        connection = peerflix(torrent, {
          connections: 100,
          path: path.join(tempDir, 'peerflix-' + uuid.v4()),
          buffer: (1.5 * 1024 * 1024).toString()
        });

        connection.server.on('listening', function() {
          if (!connection) { return reply(Boom.badRequest('Play was interrupted')); }
          omx.play('http://127.0.0.1:' + connection.server.address().port + '/');
          return reply();
        });
      });
    }
    else {
      return reply(Boom.badRequest('Torrent URL Required'));
    }
  }
});

server.route({
  method: 'POST',
  path: '/stop',
  handler: function (request, reply) {
    stop();
    return reply();
  }
});

server.route({
  method: 'GET',
  path: '/status',
  handler: function (request, reply) {
    return reply(states[omx.getState()]);
  }
});

server.route({
  method: 'GET',
  path: '/query',
  handler: function (request, reply) {
    var query = request.query.q;
    if (query) {
      kickass(query, function(err, response){
        if (err) { return reply(Boom.badRequest(err)); }
        var filteredResults = [];
        response.list.forEach(function(result) {
          if (result.category === 'TV' || result.category === 'Movies') {
            filteredResults.push(result);
          }
        });
        return reply(filteredResults);
      });
    }
    else { return reply(Boom.badRequest('Torrent query string must be present')); }
  }
});

server.route({
  method: 'POST',
  path: '/{omx_command}',
  handler: function (request, reply) {
    var omxCommand = request.params.omx_command;
    var actualCommand = omxCtrlMap[omxCommand];
    if (actualCommand) {
      omx[actualCommand]();
      return reply();
    }
    else { return reply(Boom.badRequest('Invalid OMX Player command')); }
  }
});
