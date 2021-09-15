'use strict';

var http = require('http');

module.exports = function(ev, alias) {
	var request = http.request({ host: '127.0.0.1', port: (process.env.PORT || 8080), path: '/alias/block/' + alias, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '0' } }, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			if (res.statusCode != 201) {
				try {
					var data = JSON.parse(body);
					ev.channel.send(data.error);
				} catch (err) {
					ev.channel.send('This alias is already linked to an account. :( **Oink!** :pig:');
				}
			} else { 
				ev.channel.send('Alias blocked! **Oink!** :pig:');
			}
		});
	});
	request.on('error', function(err) {
		console.error(err);
		ev.channel.send('Couldn\'t block alias. :( **Oink!** :pig:');
	});
	request.end();
};
 
