#!/usr/bin/env node

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
var execSync = require('child_process').execSync;
var cliArguments = require('minimist')(process.argv.slice(2));

if (cliArguments.help) {
  console.log([
    'You can pass several options to the server command:',
    '  --help: this message',
    '  --port: the port to use for the server (defaults to 8080)',
    '  --verbose: show the server log (defaults to true)',
    '  --subtitles: when selecting a torrent to watch, try to download matching subtitles',
    '    with `subliminal` python program (defaults to false)',
    '  --subliminal_bin: `subliminal` path/executable (defaults to \'subliminal\')',
    '  --subliminal_args: arguments to pass to the `subliminal download` command (-s option is forced)',
    '',
    '  Example:',
    '    node server --port 8081 --subtitles --subliminal_args="-l fr"'
  ].join('\n'));
  process.exit(0);
}
// Configs
var PORT = process.env.PORT || cliArguments.port || 8080;
var LOG_ENABLED = cliArguments.verbose !== undefined ? !!cliArguments.verbose : true;
var USE_SUBTITLES = !!cliArguments.subtitles;

// Params
var connection;
var states = ['PLAYING', 'PAUSED', 'IDLE'];
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

/**
 * download the best subtitles file possible through subliminal for the given torrent
 *
 * note: the subliminal -s is forced
 */
var subtitles = function(torrent) {
  var bin = cliArguments.subliminal_bin || 'subliminal';
  var options = '-s ' + (cliArguments.subliminal_args || '');
  var subliminalCommand = [bin, 'download', options, torrent.name].join(' ');
  var subliminalOutput;
  try {
    subliminalOutput = execSync(subliminalCommand, { cwd: tempDir });
  } catch (e) {
    console.log("Error when executing subliminal: " + e.message);
    return '';
  }
  //we assume the file created by subliminal is the last .srt file in the temp dir
  //we get all the srt files in the temp dir and keep the last created
  //we might need to do better than this... but I find no sure way of getting the
  //specific file created by subliminal directly
  var fileList;
  try {
    fileList = execSync('ls -1At *.srt', { cwd: tempDir, encoding: 'utf8' }).trim();
  } catch (e) {
    console.log("Error when trying to retrieve subtitle file: " + e.message);
    return '';
  }
  fileList = fileList.split('\n'); //each file is on its own line (-1 option of ls) so we split by newline
  var filename = fileList[0]; //ls is ordered by modification time (-i option) so we get the first file of list
  var peerflixFilename = 'peerflix-' + filename; //prefixing filename with peerflix to delete it with torrent cache
  fs.renameSync(path.join(tempDir, filename), path.join(tempDir, peerflixFilename));
  return peerflixFilename;
};

var stop = function() {
  clearTorrentCache();
  if (!connection) { return; }
  connection.destroy();
  connection = null;
  omx.stop();
};

// Server Setup
var server = new Hapi.Server();
server.connection({ port: PORT });

if (LOG_ENABLED) {
  var options = { logRequestPayload: true };
  var opsPath = path.normalize(__dirname +  '/log/operation');
  var errsPath = path.normalize(__dirname + '/log/error');
  var reqsPath = path.normalize(__dirname + '/log/request');
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
    return reply.file(path.join(__dirname, 'public/index.html'));
  }
});

server.route({
  method: 'GET',
  path: '/assets/{param*}',
  handler: {
    directory: {
      path: path.join(__dirname,'public')
    }
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

        var omxOptions = [];
        if (USE_SUBTITLES) {
          omxOptions.push('--subtitles', subtitles(torrent));
        }

        connection = peerflix(torrent, {
          connections: 100,
          path: path.join(tempDir, 'peerflix-' + uuid.v4()),
          buffer: (1.5 * 1024 * 1024).toString()
        });

        connection.server.on('listening', function() {
          if (!connection) { return reply(Boom.badRequest('Stream was interrupted')); }
          omx.play('http://127.0.0.1:' + connection.server.address().port + '/', omxOptions);
          omx.on('ended', function() { stop(); });
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
