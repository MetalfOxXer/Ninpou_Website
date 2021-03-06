'use strict';

var http = require('http');

module.exports = function(ev, name, callback, hideRole) {
	if (!name) return callback(null, null);
	if (!isNaN(parseInt(name))) {
		var members;
		if (!ev.guild) {
			members = ev.message.guild.members;
		} else {
			members = ev.guild.members;
		}
		console.log("discord: " + name);
		members.fetch(name).then(function(member) { 
			var roleName = "Academy Student";
			if (member.roles.hoist != null) {
				roleName = member.roles.hoist.name;
			}
			return callback(null, (member.nickname || member.user.username) + (hideRole ? '' : ' (' + roleName.replace('ū', 'uu').replace('ō', 'ou') + ')' )); 
		}).catch(function(err) { 
			console.log(err);
			http.get({ host: '127.0.0.1', port: (process.env.PORT || 8080), path: '/alias/' + name, headers: { 'Content-Type': 'application/json', 'Content-Length': '0' } }, function(res) {
				var body = '';
				res.on('data', function(chunk) {
					body += chunk;
				});
				res.on('end', function() { 
					if (res.statusCode != 200) { 
						console.error(body);
						return callback(null, 'null (LEFT)');
					} else {
						try { 
							var data = JSON.parse(body); 
							return callback(null, data.alias[0] + ' (LEFT)');
						} catch (err) {
							console.error(err);
							return callback(null, user.username + ' (LEFT)');
						}
					}
				});
			}).end();
		});
	} else {  
		console.log("non discord: " + name);
		return callback(null, name);
	}
};
