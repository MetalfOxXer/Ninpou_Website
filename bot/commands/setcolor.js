'use strict';

var http = require('http');

module.exports = function(ev, color) {
	var hasRole = false;
	ev.member.roles.cache.forEach(function(role) {
		if (role.name.toLowerCase() == 'can\'t get enough') {
			role.setColor(color);
			hasRole = true;
			ev.channel.send('Done! **Oink!** :pig:');
		}
	});
	if (!hasRole) {
		ev.channel.send('You don\'t have the "Can\'t get enough" title. :( **Oink!** :pig:');
	}
};
