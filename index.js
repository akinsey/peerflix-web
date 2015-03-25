var Hapi = require('hapi');
var Boom = require('boom');
var rimraf = require('rimraf');
var path = require('path');
var tempDir = require('os').tmpdir();
var readTorrent = require('read-torrent');
var peerflix = require('peerflix');
var uuid = require('node-uuid');
var omx = require('omxctrl');
var fs = require('fs');

var connection;

var STATUSES = ['PLAYING', 'PAUSED', 'IDLE'];
var PORT = process.argv[2] || 8080;

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

var stop = function() {
  if (!connection) return;
  connection.destroy();
  connection = null;
  omx.stop();
};

var createTempFilename = function() {
  return path.join(tempDir, 'peerflix_' + uuid.v4());
};

var clearTempFiles = function() {
  fs.readdir(tempDir, function(err, files) {
    if (err) return;
    files.forEach(function(file) {
      if (file.substr(0, 8) === 'peerflix') {
        rimraf.sync(path.join(tempDir, file));
      }
    });
  });
};

var server = new Hapi.Server();
server.connection({ port: PORT });

server.start(function () {
  console.log('Peerflix web running at:', server.info.uri);
});

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
        if (connection) stop();
        clearTempFiles();
        
        connection = peerflix(torrent, {
          connections: 100,
          path: createTempFilename(),
          buffer: (1.5 * 1024 * 1024).toString()
        });

        connection.server.on('listening', function() {
          omx.play('http://127.0.0.1:' + connection.server.address().port + '/');
          console.log('Playing torrent: ' + torrentUrl);
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
    console.log('Stopping stream');
    return reply();
  }
});

server.route({
  method: 'GET',
  path: '/status',
  handler: function (request, reply) {
    return reply(STATUSES[omx.getState()]);
  }
});

server.route({
  method: 'POST',
  path: '/{omx_command}',
  handler: function (request, reply) {
    var omxCommand = request.params.omx_command;
    var actualCommand = omxCtrlMap[omxCommand];
    if (actualCommand) {
      console.log(actualCommand);
      omx[actualCommand]();
      return reply();
    }
    else {
      return reply(Boom.badRequest('Invalid OMX Player command'));
    }
  }
});
