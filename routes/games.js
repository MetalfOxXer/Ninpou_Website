'use strict';

var mongoose = require('mongoose');
var express = require('express');
var https = require('https');
var router = express.Router();
var Game = require('../models/Game');

function parseGameSlots(data) {
	var gamename = data.split('<b>Gamename</b>: ')[1].split('\t<br />')[0];
	var gameSlots = [];
	var slots = data.split('<tr>');
	for (var i = 2; i < slots.length; i++) {
		if (slots[i].indexOf('<td colspan="3" class="slot">') != -1) {
			gameSlots.push({ 'username': null, 'realm': null, 'ping': null });
		} else {
			var username = slots[i].split('<td class="slot">')[1].split('</td>')[0];
			var realm = slots[i].split('<td class="slot">')[2].split('</td>')[0];
			var ping = slots[i].split('<td class="slot">')[3].split('</td>')[0];
			gameSlots.push({ 'username': username, 'realm': realm, 'ping': ping });
		}
	}
	return {
		'gamename': gamename,
		'slots': gameSlots
	};
}

function getGameInfo(id, players, slots, progress, callback) {
	https.get({ hostname: 'entgaming.net', path: '/forum/slots_fast.php?id=' + id + '&ie=' + (new Date()).getTime(), headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate', 'Expires': '-1', 'Pragma': 'no-cache' } }, function(response) {
		var data = '';
		response.on('data', function(chunk) {
			data += chunk;
		});
		response.on('end', function() {
			if (data.split('<b>Map</b>: ').length > 1) {
				var map = data.split('<b>Map</b>: ')[1].split('</h2>')[0];
				var owner = data.split('<b>Owner</b>: ').length > 1 ? data.split('<b>Owner</b>: ')[1].split('\t')[0] : '';
				var duration = data.split('<b>Duration</b>: ')[1].split('\t')[0];
				var gamename = data.split('<b>Gamename</b>: ')[1].split('\t')[0];
				if (gamename.toLowerCase().indexOf('ninpou') != -1 || map.toLowerCase().indexOf('ninpou') != -1 || map.toLowerCase().indexOf('nns') != -1) {
					var info = parseGameSlots(data);
					info['id'] = id;
					info['map'] = map;
					info['owner'] = owner;
					info['duration'] = duration;
					info['players'] = players;
					info['progress'] = progress;
					var obj = {
						id: id,
						gamename: gamename,
						map: map, 
						owner: owner,
						duration: duration,
						slots: info.slots,
						players: players,
						progress: progress 
					};
					Game.update({ id: id }, obj, { upsert: true }, function(err) {
						if (err) return callback(err);
						return callback(null, info);
					});
				}
			}
			return callback(null, null);
		});
	}).on('error', function(err) {
		callback(err);
	});
}

var hostedGames = [];
var inProgressGames = [];

setInterval(function() {
	var games = [];
	https.get({ hostname: 'entgaming.net', path: '/forum/games_fast.php' + '?ie=' + (new Date()).getTime(), headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate', 'Expires': '-1', 'Pragma': 'no-cache' } }, function(response) {
		var data = '';
		response.on('data', function(chunk) {
			data += chunk;
		});
		response.on('end', function() {
			var gamesData = data.split('\n');
			var count = gamesData.length;
			for (var i = 0; i < gamesData.length; i++) {
				if (gamesData[i] && gamesData[i].split('|').length > 4) {
					var id = gamesData[i].split('|')[0];
					var players = gamesData[i].split('|')[2];
					var slots = gamesData[i].split('|')[3];
					var progress = gamesData[i].split('|')[4] == '0';
					var gamename = gamesData[i].split('|')[5];
					if (gamename.indexOf('[ENT]') == -1) {
						getGameInfo(id, players, slots, progress, function(err, game) {
							if (err) {
								console.log('Error[2]: ' + err);
								return;
							}
							if (game != null) {
								games.push(game);
							}
							--count;
							if (count <= 0) hostedGames = games;
						});
					} else {
						--count;
						if (count <= 0) hostedGames = games;
					}
				} else {
					--count;
					if (count <= 0) hostedGames = games;
				}
			}
		});
	}).on('error', function(err) {
		console.log('Error: ' + err);
	});
}, 10000);

setInterval(function() {
	var games = [];
	https.get({ hostname: 'entgaming.net', path: '/forum/games_all_fast.php' + '?ie=' + (new Date()).getTime(), headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate', 'Expires': '-1', 'Pragma': 'no-cache' } }, function(response) {
		var data = '';
		response.on('data', function(chunk) {
			data += chunk;
		});
		response.on('end', function() {
			var gamesData = data.split('\n');
			var count = gamesData.length;
			for (var i = 0; i < gamesData.length; i++) {
				if (gamesData[i] && gamesData[i].split('|').length > 4) {
					var id = gamesData[i].split('|')[0];
					var progress = gamesData[i].split('|')[4] == '0';
					var gamename = gamesData[i].split('|')[5];
					if (gamename.indexOf('[ENT]') == -1) {
						(function(id, progress) {
							Game.findOne({ id: id }, function(err, game) {
								if (!err && game) {
									game.progress = progress;
									game.save(function(err) {
										if (!err && progress) games.push(game);
										--count;
										if (count <= 0) inProgressGames = games;
									});
								} else {
									--count;
									if (count <= 0) inProgressGames = games;
								}
							});
						})(id, progress);
					} else {
						--count;
						if (count <= 0) inProgressGames = games;
					}
				} else {
					--count;
					if (count <= 0) inProgressGames = games;
				}
			}
		});
	}).on('error', function(err) {
		console.log(err);
	});
}, 10000);

setInterval(function() {
	https.get({ hostname: 'tonton-bot.herokuapp.com', path: '/?ie=' + (new Date()).getTime(), headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate', 'Expires': '-1', 'Pragma': 'no-cache' } }, function(response) {
		var data = '';
		response.on('data', function(chunk) {
			data += chunk;
		});
	}).on('error', function(err) {
		console.log('Error: ' + err);
	});
}, 10000);

router.get('/', function(req, res) {
	return res.json(hostedGames);
});

router.get('/progress', function(req, res) {
	return res.json(inProgressGames);
});

router.get('/last', function(req, res) {
	Game.find({ $or: [{ recorded: false }, {recorded: { $exists: false } }], players: 9, progress: true }).sort({ _id: -1 }).limit(10).exec(function(err, games) {
		if (err) return res.status(500).json(err);
		return res.json(games);
	});
});

router.get('/:game_id', function(req, res) {
	Game.find({ id: req.params.game_id }, function(err, game) {
		if (err) return res.status(500).json(err);
		return res.json(game);
	});
});

module.exports = router;