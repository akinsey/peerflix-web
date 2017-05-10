#!/usr/bin/env node

var Hapi = require('hapi');
var Inert = require('inert');
var Boom = require('boom');
var Good = require('good');
var GoodFile = require('good-file');
var GoodConsole = require('good-console');
var GoodSqueeze = require('good-squeeze');
var ip = require('ip');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var path = require('path');
var tempDir = require('os').tmpdir();
var readTorrent = require('read-torrent');
var uuid = require('node-uuid');
var fs = require('fs');
var peerflix = require('peerflix');

// Configs
const PORT = process.env.PORT || process.argv[2] || 8080;
const LOG_ENABLED = true;
const MAX_CONNS = process.env.MAX_CONNS || 5;

// Params
var connection = [];
var conindex = 0;
var states = ['PLAYING', 'PAUSED', 'IDLE'];

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
	clearTorrentCache();
	if (!connection[conindex])
		return;

	connection[conindex].destroy();
	connection[conindex--] = null;
};

// Server Setup
var server = new Hapi.Server();
server.connection({ port: PORT });
server.register(Inert, () => {});

if (LOG_ENABLED) {
	var options = {};
	var opsPath = path.normalize(__dirname +  '/log/operation');
	var errsPath = path.normalize(__dirname + '/log/error');
	var reqsPath = path.normalize(__dirname + '/log/request');

	options.reporters = {
		consoleReporter: [{
			module: 'good-squeeze',
			name: 'Squeeze',
			args: [{ log: '*', response: '*' }]
		}, {
			module: 'good-console'
		}, 'stdout'],
		opsReporter: [{
			module: 'good-squeeze',
			name: 'Squeeze',
			args: [{ log: '*', ops: '*' }]
		}, {
			module: 'good-squeeze',
			name: 'SafeJson'
		}, {
			module: 'good-file',
			args: [opsPath]
		}],
		errsReporter: [{
			module: 'good-squeeze',
			name: 'Squeeze',
			args: [{ log: '*', error: '*' }]
		}, {
			module: 'good-squeeze',
			name: 'SafeJson'
		}, {
			module: 'good-file',
			args: [errsPath]
		}],
		reqsReporter: [{
			module: 'good-squeeze',
			name: 'Squeeze',
			args: [{ log: '*', response: '*' }]
		}, {
			module: 'good-squeeze',
			name: 'SafeJson'
		}, {
			module: 'good-file',
			args: [reqsPath]
		}]
	};
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
				if (connection.length >= MAX_CONNS)
					return reply('No more connections allowed');

				connection[++conindex] = peerflix(torrent, {
					connections: 100,
					path: path.join(tempDir, 'peerflix-' + uuid.v4()),
					buffer: (1.5 * 1024 * 1024).toString()
				});

				connection[conindex].server.once('error', function() {
					connection[conindex].server.listen(0);
				});

				connection[conindex].server.on('listening', function() {
					if (!connection[conindex])
						return reply(Boom.badRequest('Stream was interrupted'));

					console.log(connection[conindex].server.address());
					return reply({ port: connection[conindex].server.address().port });
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
		var res = []

		connection.forEach(function (conn) {
			res.push({
				downloadSpeed: conn.swarm.downloadSpeed(),
				uploadSpeed: conn.swarm.uploadSpeed(),
				paused: conn.swarm.paused,
				downloaded: conn.swarm.downloaded,
				uploaded: conn.swarm.uploaded,
				name: conn.torrent.name,
				size: conn.torrent.length
			});
		});

		return reply(res);
	}
});
