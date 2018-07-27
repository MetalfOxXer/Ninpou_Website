'use strict';

var mongoose = require('mongoose');
var express = require('express');
var router = express.Router();
var moment = require('moment');
var Alias = require('../models/Alias'); 
var Mission = require('../models/Mission');
var Game = require('../models/Game');
var Stat = require('../models/Stat');
var Calculator = require('./calculator');
var StatCalculator = require('./statcalculator');

function dateFromObjectId(objectId) {
	return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
};

function isToday(momentDate) {
	var REFERENCE = moment();
	var TODAY = REFERENCE.clone().startOf('day');
	return momentDate.isSame(TODAY, 'd');
}

function isYesterday(momentDate) {
	var REFERENCE = moment();
	var YESTERDAY = REFERENCE.clone().subtract(1, 'days').startOf('day');
	return momentDate.isSame(YESTERDAY, 'd');
}

function isWithinAWeek(momentDate) {
	var REFERENCE = moment();
	var A_WEEK_OLD = REFERENCE.clone().subtract(7, 'days').startOf('day');
	return momentDate.isAfter(A_WEEK_OLD);
}

router.use('/:username', function(req, res, next) {
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, user) {
		if (err) return res.status(500).json({ 'error': err });
		req.user = user;
		next();
	});
});

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}


function isMissionAvailable(username, name, frequency, index, callback) {
	Mission.find({ username: username, name: name }).sort('-_id').limit(1).exec(function(err, missions) {
		if (err) return callback(err);
		var doneToday = missions.length > 0 && isToday(moment(dateFromObjectId(missions[0]._id.toString())));
		var doneThisWeek = missions.length > 0 && isWithinAWeek(moment(dateFromObjectId(missions[0]._id.toString())));
		if ((frequency == 'daily' && doneToday) || (frequency == 'weekly' && doneThisWeek)) return callback(null, false); 
		return callback(null, true, index);
	});
};

function getAvailableMissions(username, callback) {
	var missions = [['rescue', 'daily'], ['gamble', 'daily'], ['rob', 'daily'], ['play', 'daily'], ['win', 'daily'], ['farm3k', 'daily'], ['kills20', 'daily'], ['deaths5', 'daily'], ['assists10', 'daily'], ['dailies', 'daily'], ['top', 'weekly']];
	var availableMissions = [];
	var evaluatedMissions = 0;
	for (var i = 0; i < missions.length; i++) {
		isMissionAvailable(username, missions[i][0], missions[i][1], i, function(err, available, mission) {
			if (available) availableMissions.push(mission);
			++evaluatedMissions;
			if (evaluatedMissions == missions.length) {
				availableMissions.sort();
				for (var j = 0; j < availableMissions.length; j++) {
					availableMissions[j] = missions[availableMissions[j]][0];
				}
				return callback(availableMissions);
			}
		});
	}
};

function areAllMissionsCompleted(missions) {
	var nonSRankMissions = ['rescue', 'play', 'win', 'farm3k', 'kills20', 'deaths5', 'assists10'];
	for (var i = 0; i < missions.length; i++) {
		for (var j = 0; j < nonSRankMissions.length; j++) {
			if (missions[i] == nonSRankMissions[j]) {
				return false;
			}
		}
	}
	return true; 
};

function dailyGameMission(req, res, name, condition, conditionError, goldReward, xpReward) {
	Mission.find({ username: req.user.username, name: name }).sort('-_id').limit(1).exec(function(err, missions) {
		var doneToday = missions.length > 0 && isToday(moment(dateFromObjectId(missions[0]._id.toString())));
		var doneYesterday = missions.length > 0 && isYesterday(moment(dateFromObjectId(missions[0]._id.toString())));
		if (doneToday) {
			return res.status(400).json({ 'error': 'You already completed this mission today! **Oink!**' });
		} else {  
			var aliases = [];
			for (var i = 0; i < req.user.alias.length; i++) {
				aliases.push(new RegExp(['^', escapeRegExp(req.user.alias[i]), '$'].join(''), 'i'));
			}  
			condition['slots']['$elemMatch']['username'] = { $in: aliases };
			condition['recorded'] = true;
			Game.find(condition).sort('-_id').limit(1).exec(function(err, games) {
				if (games.length == 0 || !isToday(moment(dateFromObjectId(games[0]._id.toString())))) {
					return res.status(400).json({ 'error': conditionError });
				} else {
					var amount = goldReward;
					var xp = xpReward;
					var streak = doneYesterday;
					if (streak) {
						amount *= 2;
						xp *= 2;
					}
					var today = new Date();
					if (today.getDay() == 6 || today.getDay() == 0) {
						amount *= 2;
						xp *= 2;
					}
					var mission = new Mission({
						username: req.user.username,
						name: name
					});
					mission.save(function(err) {
						if (err) return res.status(500).json({ 'error': err });
						req.user.gold += amount;
						req.user.xp += xp;
						var levelup = false;
						while (req.user.xp > 100) { 
							req.user.level += 1;
							req.user.xp -= 100;
							levelup = true;
						}
						req.user.save(function(err) {
							if (err) return res.status(500).json({ 'error': err });
							return res.status(200).json({ streak: streak, amount: amount, xp: xp, level: req.user.level, levelup: levelup });
						});
					}); 
				} 
			});
		} 
	});
}

// rescue tonton 
router.post('/:username/rescue', function(req, res) {
	Mission.find({ username: req.user.username, name: 'rescue' }).sort('-_id').limit(1).exec(function(err, missions) {
		var doneToday = missions.length > 0 && isToday(moment(dateFromObjectId(missions[0]._id.toString())));
		var doneYesterday = missions.length > 0 && isYesterday(moment(dateFromObjectId(missions[0]._id.toString())));
		if (doneToday) {
			return res.status(400).json({ 'error': 'You already completed this mission today! **Oink!**' });
		} else {
			var amount = 10;
			var streak = doneYesterday;
			var double = Math.round(Math.random() * 10) == 0;
			if (streak) amount *= 2;
			if (double) amount *= 2;
			var today = new Date();
			if (today.getDay() == 6 || today.getDay() == 0) {
				amount *= 2;
			}
			var mission = new Mission({
				username: req.user.username, 
				name: 'rescue'
			});
			mission.save(function(err) {
				if (err) return res.status(500).json({ 'error': err });
				req.user.gold += amount;
				req.user.save(function(err) {
					if (err) return res.status(500).json({ 'error': err });
					return res.status(200).json({ streak: streak, double: double, amount: amount });
				});
			});
		}
	});
});

// gamble 
router.post('/:username/gamble', function(req, res) {
	Mission.find({ username: req.user.username, name: 'gamble' }).sort('-_id').limit(1).exec(function(err, missions) {
		var doneToday = missions.length > 0 && isToday(moment(dateFromObjectId(missions[0]._id.toString())));
		if (doneToday) {
			return res.status(400).json({ 'error': 'You already completed this mission today! **Oink!**' });
		} else { 
			if (!req.body.amount || req.body.amount > req.user.gold) {
				return res.status(400).json({ 'error': 'You don\'t have this amount to bet! **Oink!**' });
			} 
			var amount = Math.round(Math.min(req.body.amount, req.user.gold * 0.1));
			getAvailableMissions(req.user.username, function(missions) {
				var chance;
				if (areAllMissionsCompleted(missions)) {
					chance = 75;
				} else {
					chance = 50;
				}
				var won = Math.round(Math.random() * 100) < chance; 
				if (won) amount *= 2;
				else amount = -amount; 
				var mission = new Mission({
					username: req.user.username, 
					name: 'gamble', 
					won: won 
				});
				mission.save(function(err) {
					if (err) return res.status(500).json({ 'error': err });
					req.user.gold += amount;
					req.user.save(function(err) {
						if (err) return res.status(500).json({ 'error': err });
						return res.status(200).json({ streak: false, won: won, amount: amount });
					});
				});
			});
		} 
	});
});
 
// gamble 
router.post('/:username/rob', function(req, res) {
	Mission.find({ username: req.user.username, name: 'rob' }).sort('-_id').limit(1).exec(function(err, missions) {
		var doneToday = missions.length > 0 && isToday(moment(dateFromObjectId(missions[0]._id.toString())));
		if (doneToday) {
			return res.status(400).json({ 'error': 'You already completed this mission today! **Oink!**' });
		} else { 
			Alias.findOne({ username: req.body.user.toLowerCase() }, function(err, anotherUser) {
				if (err) return res.status(500).json({ 'error': err });
				var amount = Math.round(Math.min(req.user.gold * 0.1, anotherUser.gold * 0.1));
				var percentage = req.user.level - anotherUser.level;
				var won = Math.round(Math.random() * 100) < (50 + percentage);
				if (won) {
					req.user.gold += amount;
					anotherUser.gold -= amount;
				} else {
					req.user.gold -= amount;
					anotherUser.gold += amount;
				}
				var mission = new Mission({
					username: req.user.username, 
					name: 'rob', 
					won: won 
				}); 
				mission.save(function(err) {
					if (err) return res.status(500).json({ 'error': err });
					req.user.save(function(err) {
						if (err) return res.status(500).json({ 'error': err });
						anotherUser.save(function(err) {
							if (err) return res.status(500).json({ 'error': err });
							return res.status(200).json({ streak: false, won: won, amount: amount });
						});
					});
				});
			});
		} 
	});
});
 
// dailies  
router.post('/:username/dailies', function(req, res) {
	Mission.find({ username: req.user.username, name: 'dailies' }).sort('-_id').limit(1).exec(function(err, missions) {
		var doneToday = missions.length > 0 && isToday(moment(dateFromObjectId(missions[0]._id.toString())));
		var doneYesterday = missions.length > 0 && isYesterday(moment(dateFromObjectId(missions[0]._id.toString())));
		if (doneToday) {
			return res.status(400).json({ 'error': 'You already completed this mission today! **Oink!**' });
		} else { 
			getAvailableMissions(req.user.username, function(missions) {
				if (!areAllMissionsCompleted(missions)) {
					return res.status(400).json({ 'error': 'You haven\'t completed all daily missions! **Oink!**' });
				} else {
					Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
						if (err || !alias) return res.status(500).json({ error: err });
						var amount; 
						if (alias.rank == 'chunnin') {
							amount = 2000;
						} else if (alias.rank == 'tokubetsu jounin') {
							amount = 4000;
						} else if (alias.rank == 'jounin') {
							amount = 8000;
						} else if (alias.rank == 'anbu') {
							amount = 16000;
						} else if (alias.rank == 'kage') {
							amount = 24000;
						} else {
							amount = 1000;
						}
						var xp = 50;
						var streak = doneYesterday;
						if (streak) {
							amount *= 2;
							xp *= 2;
						}
						var today = new Date();
						if (today.getDay() == 6 || today.getDay() == 0) {
							amount *= 2;
							xp *= 2;
						}
						var mission = new Mission({
							username: req.user.username,
							name: 'dailies'
						});
						mission.save(function(err) {
							if (err) return res.status(500).json({ 'error': err });
							req.user.gold += amount;
							req.user.xp += xp;
							var levelup = false;
							while (req.user.xp > 100) { 
								req.user.level += 1;
								req.user.xp -= 100;
								levelup = true;
							}
							req.user.save(function(err) {
								if (err) return res.status(500).json({ 'error': err });
								return res.status(200).json({ streak: streak, amount: amount, xp: xp, level: req.user.level, levelup: levelup });
							});
						});
					});
				}
			});
		} 
	});
});
 
// play
router.post('/:username/play', function(req, res) {
	dailyGameMission(req, res, 'play', { 'slots': { '$elemMatch': {} } }, 'You didn\'t play any game today! **Oink!**', 50, 10);
});

// win
router.post('/:username/win', function(req, res) {
	dailyGameMission(req, res, 'win', { 'slots': { '$elemMatch': { 'win': true } } }, 'You didn\'t win any game today! **Oink!**', 200, 20);
});

// farm 3k
router.post('/:username/farm3k', function(req, res) {
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err || !alias) return res.status(404).json({ error: 'User not found.' });
		var threshold, goldReward; 
		if (alias.rank == 'chunnin') {
			threshold = 22;
			goldReward = 1000;
		} else if (alias.rank == 'tokubetsu jounin') {
			threshold = 25;
			goldReward = 1500;
		} else if (alias.rank == 'jounin') {
			threshold = 27;
			goldReward = 2000;
		} else if (alias.rank == 'anbu') {
			threshold = 30;
			goldReward = 2500;
		} else if (alias.rank == 'kage') {
			threshold = 33;
			goldReward = 3000;
		} else {
			threshold = 20;
			goldReward = 500;
		}
		dailyGameMission(req, res, 'farm3k', { 'slots': { '$elemMatch': { 'gpm': { $gte: threshold } } } }, 'You didn\'t play any game with over ' + (threshold * 100) + ' gpm today! **Oink!**', goldReward, 20);
	});
});
 
// kills 20
router.post('/:username/kills20', function(req, res) {
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err || !alias) return res.status(404).json({ error: 'User not found.' });
		var threshold, goldReward; 
		if (alias.rank == 'chunnin') {
			threshold = 12;
			goldReward = 1000;
		} else if (alias.rank == 'tokubetsu jounin') {
			threshold = 15;
			goldReward = 1500;
		} else if (alias.rank == 'jounin') {
			threshold = 17;
			goldReward = 2000;
		} else if (alias.rank == 'anbu') {
			threshold = 20;
			goldReward = 2500;
		} else if (alias.rank == 'kage') {
			threshold = 23;
			goldReward = 3000;
		} else {
			threshold = 10;
			goldReward = 500;
		}
		dailyGameMission(req, res, 'kills20', { 'slots': { '$elemMatch': { 'kills': { $gte: threshold } } } }, 'You didn\'t play any game with over ' + threshold + ' kills today! **Oink!**', goldReward, 20);
	});
});

// deaths 5 
router.post('/:username/deaths5', function(req, res) {
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err || !alias) return res.status(404).json({ error: 'User not found.' });
		var threshold, goldReward; 
		if (alias.rank == 'chunnin') {
			threshold = 12;
			goldReward = 1000;
		} else if (alias.rank == 'tokubetsu jounin') {
			threshold = 11;
			goldReward = 1500;
		} else if (alias.rank == 'jounin') {
			threshold = 10;
			goldReward = 2000;
		} else if (alias.rank == 'anbu') {
			threshold = 9;
			goldReward = 2500;
		} else if (alias.rank == 'kage') {
			threshold = 7;
			goldReward = 3000;
		} else {
			threshold = 13;
			goldReward = 500;
		}
		dailyGameMission(req, res, 'deaths5', { 'slots': { '$elemMatch': { 'deaths': { $lte: threshold } } } }, 'You didn\'t play any game with less ' + threshold + ' deaths today! **Oink!**', goldReward, 20);
	}); 
});

// assists 20
router.post('/:username/assists10', function(req, res) {
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err || !alias) return res.status(404).json({ error: 'User not found.' });
		var threshold, goldReward; 
		if (alias.rank == 'chunnin') {
			threshold = 7;
			goldReward = 1000;
		} else if (alias.rank == 'tokubetsu jounin') {
			threshold = 8;
			goldReward = 1500;
		} else if (alias.rank == 'jounin') {
			threshold = 9;
			goldReward = 2000;
		} else if (alias.rank == 'anbu') {
			threshold = 10;
			goldReward = 2500;
		} else if (alias.rank == 'kage') {
			threshold = 12;
			goldReward = 3000;
		} else {
			threshold = 6;
			goldReward = 500;
		}
		dailyGameMission(req, res, 'assists10', { 'slots': { '$elemMatch': { 'assists': { $gte: threshold } } } }, 'You didn\'t play any game with over ' + threshold + ' assists today! **Oink!**', goldReward, 20);
	}); 
});

// top
router.post('/:username/top', function(req, res) { 
	Mission.find({ username: req.user.username, name: 'top' }).sort('-_id').limit(1).exec(function(err, missions) {
		var doneThisWeek = missions.length > 0 && isWithinAWeek(moment(dateFromObjectId(missions[0]._id.toString())));
		if (doneThisWeek) {
			return res.status(400).json({ 'error': 'You already completed this mission this week! **Oink!**' });
		} else { 
			StatCalculator.getAllPlayersRanking(function(err, stats) {
				if (err) return res.status(400).json({ 'error': err });
				stats.sort(function(a, b) { 
					return a.ranking['score'] - b.ranking['score'];
				});   
				if (stats[0]._id == req.user.username) {
					var amount = 50000;
					var xp = 100;
					var today = new Date();
					var mission = new Mission({
						username: req.user.username,
						name: 'top'
					});
					mission.save(function(err) {
						if (err) return res.status(500).json({ 'error': err });
						req.user.gold += amount;
						req.user.xp += xp;
						var levelup = false;
						while (req.user.xp > 100) { 
							req.user.level += 1;
							req.user.xp -= 100;
							levelup = true;
						}
						req.user.save(function(err) {
							if (err) return res.status(500).json({ 'error': err });
							return res.status(200).json({ amount: amount, xp: xp, level: req.user.level, levelup: levelup });
						}); 
					}); 
				} else {
					return res.status(400).json({ 'error': 'You are not the top! **Oink!**' });
				}
			});   
		} 
	});
});

router.get('/:username/available', function(req, res) {
	getAvailableMissions(req.user.username, function(missions) {
		return res.status(200).json({ missions: missions, completed: areAllMissionsCompleted(missions) });
	});
});

router.post('/:username/rank/genin', function(req, res) {
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err) return res.status(500).json({ error: err });
		alias.rank = 'genin';
		alias.save(function(err) {
			return res.send();
		});
	});
});

router.post('/:username/rank/chunnin', function(req, res) { 
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err) return res.status(500).json({ error: err });
		else if (alias.affiliation == 'none') return res.status(400).json({ error: 'You must join a village before doing a rank mission.' });
		StatCalculator.getPlayerStats(req.params.username, function(err, stats) {
			if (err) return res.status(400).json({ 'error': err });
			if (stats.games < 10) return res.status(400).json({ error: 'You must play at least 10 games to complete this mission.' });
			else if (stats.points < 50) return res.status(400).json({ error: 'You must have at least 50 average points to complete this mission.' });
			var aliases = [];
			for (var i = 0; i < alias.alias.length; i++) {
				aliases.push(new RegExp(['^', escapeRegExp(alias.alias[i]), '$'].join(''), 'i'));
			}  
			var condition = { slots: { $elemMatch: { username: { $in: aliases }, kills: { $gte: 15 }, deaths: { $lte: 10 } } }, recorded: true };
			Game.find(condition).sort('-_id').limit(1).exec(function(err, games) {
				if (games.length == 0 || !isToday(moment(dateFromObjectId(games[0]._id.toString())))) {
					return res.status(400).json({ error: 'You didn\'t play any game with over 15 kills and less than 10 deaths today.' });
				} else {
					alias.rank = 'chunnin';
					alias.save(function(err) {
						if (err) return res.status(500).json({ error: err });
						return res.status(200).send();
					});
				} 
			});
		}); 
	});
});

router.post('/:username/rank/tokubetsu', function(req, res) { 
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err) return res.status(500).json({ error: err });
		else if (alias.affiliation == 'none') return res.status(400).json({ error: 'You must join a village before doing a rank mission.' });
		StatCalculator.getPlayerStats(req.params.username, function(err, stats) {
			if (err) return res.status(400).json({ 'error': err });
			if (stats.games < 25) return res.status(400).json({ error: 'You must play at least 25 games to complete this mission.' });
			else if (stats.points < 75) return res.status(400).json({ error: 'You must have at least 75 average points to complete this mission.' });
			var aliases = [];
			for (var i = 0; i < alias.alias.length; i++) {
				aliases.push(new RegExp(['^', escapeRegExp(alias.alias[i]), '$'].join(''), 'i'));
			}  
			var condition = { slots: { $elemMatch: { username: { $in: aliases }, kills: { $gte: 20 }, deaths: { $lte: 10 } } }, recorded: true };
			Game.find(condition).sort('-_id').limit(1).exec(function(err, games) {
				if (games.length == 0 || !isToday(moment(dateFromObjectId(games[0]._id.toString())))) {
					return res.status(400).json({ error: 'You didn\'t play any game with over 20 kills and less than 10 deaths today.' });
				} else {
					alias.rank = 'tokubetsu jounin';
					alias.save(function(err) {
						if (err) return res.status(500).json({ error: err });
						return res.status(200).send();
					});
				} 
			});
		}); 
	});
});

router.post('/:username/rank/jounin', function(req, res) { 
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err) return res.status(500).json({ error: err });
		else if (alias.affiliation == 'none') return res.status(400).json({ error: 'You must join a village before doing a rank mission.' });
		StatCalculator.getPlayerStats(req.params.username, function(err, stats) {
			if (err) return res.status(400).json({ 'error': err });
			if (stats.games < 35) return res.status(400).json({ error: 'You must play at least 35 games to complete this mission.' });
			else if (stats.points < 100) return res.status(400).json({ error: 'You must have at least 100 average points to complete this mission.' });
			var aliases = [];
			for (var i = 0; i < alias.alias.length; i++) {
				aliases.push(new RegExp(['^', escapeRegExp(alias.alias[i]), '$'].join(''), 'i'));
			}  
			var condition = { slots: { $elemMatch: { username: { $in: aliases }, kills: { $gte: 25 }, deaths: { $lte: 8 } } }, recorded: true };
			Game.find(condition).sort('-_id').limit(1).exec(function(err, games) {
				if (games.length == 0 || !isToday(moment(dateFromObjectId(games[0]._id.toString())))) {
					return res.status(400).json({ error: 'You didn\'t play any game with over 25 kills and less than 8 deaths today.' });
				} else {
					alias.rank = 'jounin';
					alias.save(function(err) {
						if (err) return res.status(500).json({ error: err });
						return res.status(200).send();
					});
				} 
			});
		}); 
	});
});

router.post('/:username/rank/anbu', function(req, res) { 
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err) return res.status(500).json({ error: err });
		else if (alias.affiliation == 'none') return res.status(400).json({ error: 'You must join a village before doing a rank mission.' });
		StatCalculator.getPlayerStats(req.params.username, function(err, stats) {
			if (err) return res.status(400).json({ 'error': err });
			if (stats.games < 50) return res.status(400).json({ error: 'You must play at least 50 games to complete this mission.' });
			else if (stats.points < 150) return res.status(400).json({ error: 'You must have at least 150 average points to complete this mission.' });
			var aliases = [];
			for (var i = 0; i < alias.alias.length; i++) {
				aliases.push(new RegExp(['^', escapeRegExp(alias.alias[i]), '$'].join(''), 'i'));
			}  
			var condition = { slots: { $elemMatch: { username: { $in: aliases }, kills: { $gte: 35 }, deaths: { $lte: 5 } } }, recorded: true };
			Game.find(condition).sort('-_id').limit(1).exec(function(err, games) {
				if (games.length == 0 || !isToday(moment(dateFromObjectId(games[0]._id.toString())))) {
					return res.status(400).json({ error: 'You didn\'t play any game with over 35 kills and less than 5 deaths today.' });
				} else {
					alias.rank = 'anbu';
					alias.save(function(err) {
						if (err) return res.status(500).json({ error: err });
						return res.status(200).send();
					});
				} 
			});
		}); 
	});
});

router.post('/:username/rank/kage', function(req, res) { 
	Alias.findOne({ username: req.params.username.toLowerCase() }, function(err, alias) {
		if (err) return res.status(500).json({ error: err });
		else if (alias.affiliation == 'none') return res.status(400).json({ error: 'You must join a village before doing a rank mission.' });
		StatCalculator.getAllPlayersRanking(function(err, stats) {
			if (err) return res.status(400).json({ 'error': err });
			stats.sort(function(a, b) { 
				return a.ranking['score'] - b.ranking['score'];
			});   
			(function next(i) {
				if (i == stats.length) return res.status(400).json({ error: 'You are not the top player of your village.' });
				Alias.findOne({ username: stats[i]._id }, function(err, anotherAlias) {
					if (err) return res.status(400).json({ error: err });
					else if (anotherAlias && anotherAlias.affiliation == alias.affiliation) {
						if (anotherAlias.username == alias.username) {
							alias.rank = 'kage';
							alias.save(function(err) {
								if (err) return res.status(500).json({ error: err });
								return res.status(200).send();
							});
						} else {
							return res.status(400).json({ error: 'You are not the top player of your village.' });
						}
					} else {
						next(i + 1);
					}
				});
			})(0);
		}); 
	});
	 
});

module.exports = router;
