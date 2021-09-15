'use strict';

var getPlayerName = require('./getplayername');
var whois_promise = require('./whois_promise');
var moment = require('moment');

function dateFromObjectId(objectId) {
	return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
}

function criteriaOnSlot(slot, criteria) {
	return slot.stat && slot.stat[criteria] || slot[criteria] || 0;
};

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

function slotToString(slot, largestName, largestRealm, largestCriteria, recorded, spectator, criteria) {
	var response = '';
	if (!slot.username) {
		var nameSpaces = '';
		for (var j = 0; j < largestName - 5; j++) {
			nameSpaces += ' ';
		}
		response += '[' + nameSpaces + 'Empty]\n';
	} else {
		var nameSpaces = '';
		for (var j = 0; j < largestName - slot.username.length; j++) {
			nameSpaces += ' ';
		}
		var realmSpaces = '';
		for (var j = 0; j < largestRealm - slot.realm.length; j++) {
			realmSpaces += ' ';
		}
		var criteriaSpaces = '';
		for (var j = 0; j < largestCriteria - (Math.round(criteriaOnSlot(slot, criteria)) + '').length; j++) {
			criteriaSpaces += ' ';
		}
		if (recorded && !spectator) {
			response += '[' + nameSpaces + slot.username + ']' + ' [K: ' + (' '.repeat(2 - (slot.kills + '').length)) + slot.kills + '] [D: ' + (' '.repeat(2 - (slot.deaths + '').length)) + slot.deaths + '] [A: ' + (' '.repeat(2 - (slot.assists + '').length)) + slot.assists + '] [P: ' + (' '.repeat(4 - (Math.abs(slot.points) + '').length)) + slot.points + '] [GPM: ' + (' '.repeat(4 - ((slot.gpm * 100) + '').length)) + (slot.gpm * 100) + '] [' + (slot.hero && slot.hero.name ? slot.hero.name : 'Unknown' ) + ']'; 
		} else {
			response += '[' + nameSpaces + slot.username + ']' + ' [' + capitalizeFirstLetter(criteria) + ': ' + criteriaSpaces + Math.round(criteriaOnSlot(slot, criteria)) + ']';
		}
		if (slot.error != null && criteria == 'points') {
			var errorStr = '' + slot.error.toFixed(2);
			for (var i = 0; i < 4 - errorStr.length; i++) {
				errorStr = ' ' + errorStr;
			}
			response += ' [Margin of error: ' + errorStr + ']';
		}
		response += '\n';
	}
	return response;
}

module.exports = function(ev, game, callback, criteria) {
	var players = 0;
	var largestName = 5; 
	var largestRealm = 0;
	var largestCriteria = 0;
	criteria = criteria || 'score'; 
	(function next(i, players, largestName, largestRealm, largestCriteria) {
		if (i == game.slots.length) {
			getPlayerName(ev, game.owner, function(err, ownerName) {
				var response = '```ini\n'; 
				if (game.recorded) {
					response += '         Id; ' + game.id + '\n';
					if (game.eventname) {
					response += '      Event; ' + game.eventname + '\n';
					} else {
					response += '      Event; None\n';
					}
					response += '   Duration; ' + game.duration + '\n';
					response += '    Balance; ' + (game.balance * 100).toFixed(2) + '%\n';
					//response += 'Recordable?; ' + (game.recordable ? 'Yes' : 'No') + '\n';
					if (game.progress) { 
						var date = dateFromObjectId(game._id);
						var m = moment(date);
						response += '     Hosted; ' + m.fromNow() + '\n';
					}
					response += '     Ranked; ' + (game.ranked ? 'yes' : 'no') + '\n';
				}
				response += '\nSlots; [' + players + '/' + game.slots.length + ']\n';
				if (game.slots.length >= 9) {
					if (game.recorded) {
						var points = 0;
						var win = false;
						for (var i = 0; i < 3; i++) {
							points += game.slots[i].points;
							if (game.slots[i].win) {
								win = true;
							}
						}
						response += 'Konoha;   (' + Math.round(points) + ')\n';
						if (win) {
							response += 'WINNING TEAM\n';
						}
					} else {
						var averageScore = ((criteriaOnSlot(game.slots[0], criteria)) + (criteriaOnSlot(game.slots[1], criteria)) + (criteriaOnSlot(game.slots[2], criteria)));
						response += 'Konoha;   (Predicted ' + capitalizeFirstLetter(criteria) + ': ' + Math.round(averageScore) + ')\n';
					} 
					for (var i = 0; i < 3; i++) {
						response += slotToString(game.slots[i], largestName, largestRealm, largestCriteria, game.recorded, false, criteria);
					}
					if (game.recorded) {
						var points = 0;
						var win = false;
						for (var i = 3; i < 6; i++) {
							points += game.slots[i].points;
							if (game.slots[i].win) {
								win = true;
							}
						}
						response += 'Oto;      (' + Math.round(points) + ')\n';
						if (win) {
							response += 'WINNING TEAM\n';
						}
					} else {
						var averageScore = ((criteriaOnSlot(game.slots[3], criteria)) + (criteriaOnSlot(game.slots[4], criteria)) + (criteriaOnSlot(game.slots[5], criteria)));
						response += 'Oto;      (Predicted ' + capitalizeFirstLetter(criteria) + ': ' + Math.round(averageScore) + ')\n';
					}
					for (var i = 3; i < 6; i++) {
						response += slotToString(game.slots[i], largestName, largestRealm, largestCriteria, game.recorded, false, criteria);
					}
					if (game.recorded) {
						var points = 0;
						var win = false;
						for (var i = 6; i < 9; i++) {
							points += game.slots[i].points;
							if (game.slots[i].win) {
								win = true;
							}
						}
						response += 'Akatsuki; (' + Math.round(points) + ')\n';
						if (win) {
							response += 'WINNING TEAM\n';
						}
					} else {
						var averageScore = ((criteriaOnSlot(game.slots[6], criteria)) + (criteriaOnSlot(game.slots[7], criteria)) + (criteriaOnSlot(game.slots[8], criteria)));
						response += 'Akatsuki; (Predicted ' + capitalizeFirstLetter(criteria) + ': ' + Math.round(averageScore) + ')\n';
					}
					for (var i = 6; i < 9; i++) {
						response += slotToString(game.slots[i], largestName, largestRealm, largestCriteria, game.recorded, false, criteria);
					} 
					if (game.slots.length > 9) {
						response += 'Spectators;\n';
						for (var i = 9; i < game.slots.length; i++) {
							response += slotToString(game.slots[i], largestName, largestRealm, largestCriteria, game.recorded, true, criteria);
						}
					}
				} else {
					for (var i = 0; i < game.slots.length; i++) {
						response += slotToString(game.slots[i], largestName, largestRealm, largestCriteria, false, false, criteria);
					}
				}
				response += '```\n'; 
				return callback(response);
			});
		} else { 
			var getPlayerNameAndNext = function(nameToFetch) {
				getPlayerName(ev, nameToFetch, function(err, playerName) {
					if (playerName) {
						game.slots[i].username = playerName;
						++players;
						if (game.slots[i].username.length > largestName) {
							largestName = game.slots[i].username.length;
						}
						if (game.slots[i].realm == 'server.eurobattle.net') {
							game.slots[i].realm = 'EuroBattle';
						}
						if (game.slots[i].realm.length > largestRealm) {
							largestRealm = game.slots[i].realm.length;
						}
						if ((Math.round(criteriaOnSlot(game.slots[i], criteria)) + '').length > largestCriteria) {
							largestCriteria = (Math.round(criteriaOnSlot(game.slots[i], criteria)) + '').length;
						}
					}
					return next(i + 1, players, largestName, largestRealm, largestCriteria);
				});
			};
			whois_promise(ev, encodeURIComponent(game.slots[i].username)).then(function(username) {
				getPlayerNameAndNext(username);
			}).catch(function(err) {
				getPlayerNameAndNext(game.slots[i].username);
			});
		}
	})(0, players, largestName, largestRealm, largestCriteria);
}; 
