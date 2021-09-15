'use strict';

var http = require('http');

module.exports = function(ev, alias, author) {
	var request = http.request({ host: '127.0.0.1', port: (process.env.PORT || 8080), path: '/alias/' + (author || ev.author.id) + '/' + alias, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': '0' } }, function(res) {
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
					ev.channel.send('This alias is already linked to another account. :( **Oink!** :pig:');
				} 
			} else { 
				ev.channel.send('Alias added! **Oink!** :pig:');
			}
		});
	});
	request.on('error', function(err) {
		console.error(err);
		ev.channel.send('Couldn\'t add alias. :( **Oink!** :pig:');
	});
	request.end();
};
