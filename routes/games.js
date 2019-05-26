'use strict';

var mongoose = require('mongoose');
var express = require('express');
var https = require('https');
var router = express.Router();
var Game = require('../models/Game');
var Stat = require('../models/Stat');
var Alias = require('../models/Alias');
var Hero = require('../models/Hero');
var StatCalculator = require('./statcalculator');
var BalanceCalculator = require('./balancecalculator');

router.get('/', function(req, response) {
	var request = https.request({ host: 'wc3maps.com', path: '/vue/gamelist.php?_=' + (new Date()).getTime(), method: 'GET', headers: { 'Content-Type': 'application/json', 'Content-Length': '0' } }, function(res) {
		var body = '';
		res.on('data', function(chunk) { 
			body += chunk;
		});
		res.on('end', function() {
			if (res.statusCode != 200) {
				return response.status(500).json({ error:'Couldn\'t fetch games.' }); 
			} else {
				try {
					var games = JSON.parse(body);
					var ninpouGames = [];
					for (var i = 0; i < games.length; i++) {
						if (games[i].name.toLowerCase().indexOf('ninpou') != -1) {
							ninpouGames.push(games[i]);
						}
					}
					return response.status(200).json(ninpouGames);
				} catch (err) {
					return response.status(500).json({ error:'Error while parsing game:' + e });
				}
			}
		});
	}); 
	request.on('error', function(err) {
		return response.status(500).json({ error:err }); 
	});
	request.end();
});

router.get('/recorded', function(req, res) {
	Game.find({ recorded: true }).sort({ _id: -1 }).limit(10).exec(function(err, games) {
		if (err) return res.status(500).json({ error:err });
		return res.json(games);
	});
});
 
router.post('/balance', function(req, res) {
	var players = req.body.players;
	var game = new Game({
		id: mongoose.Types.ObjectId().toString(),
		createdAt: new Date(),
		gamename: 'Naruto Ninpou Storm',
		map: 'NarutoNS9.2.w3x',
		owner: 'None',
		duration: '00:00:00',
		slots: [],
		players: players.length,
		progress: false,
		recorded: false,
		balance_factor: 1.0,
		recordable: true
	});
	for (var i = 0; i < players.length; i++) {
		game.slots.push({
			username: players[i],
			realm: 'Unknown'
		});
	}
	for (var i = players.length; i < 9; i++) {
		game.slots.push({
			username: null,
			realm: 'Unknown'
		});
	}
	(function next(i) {
		if (i == players.length) {
			BalanceCalculator.getOptimalBalance(game.slots, 'points', true, function(err, swaps) {
				if (err) return res.status(500).json({ error: err });
				for (var j = 0; j < swaps.length; j++) {
					var tmp = game.slots[swaps[j][0]];
					game.slots[swaps[j][0]] = game.slots[swaps[j][1]];
					game.slots[swaps[j][1]] = tmp;
				}
				return res.json({ game: game, swaps: swaps });
			}); 
		} else {
			StatCalculator.getPlayerStats(players[i], function(err, stat) {
				if (err) stat = null; 
				if (stat == null) {
					stat = {
						username: players[i],
						realm: 'Unknown'
					}
				} else {
					stat.alias = stat._id;
					stat.realm = 'Unknown';
				}
				game.slots[i] = stat;
				next(i + 1);
			}, true);
		}
	})(0);
});

router.get('/:game_id', function(req, res) {
	Game.findOne({ id: req.params.game_id }).lean().exec(function(err, game) {
		if (err) return res.status(500).json({ error:err });
		else if (!game) return res.status(404).json({ error:'Game not found.' });
		if (game.recorded) { 
			(function getHeroOnSlot(slot) {
				if (slot == game.slots.length) {
					return res.json(game);
				} else {
					Hero.findOne({ id: game.slots[slot].hero }, function(err, hero) {
						if (err) return res.status(500).json({ error:err });
						game.slots[slot].hero = hero || game.slots[slot].hero;
						getHeroOnSlot(slot + 1);
					});
				}
			})(0);
		} else {
			return res.json(game);
		}
	});
});

module.exports = router;
