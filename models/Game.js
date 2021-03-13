var mongoose = require('mongoose');

var gameSchema = mongoose.Schema({
	id: { type: String, required: true, unique: true, index: true },
	createdAt: { type: Date, default: Date.now },
	gamename: { type: String, required: true },
	map: { type : String, required: true },
	owner: { type: String },
	duration: { type: String },
	slots: [{
		username: { type: String },
		alias: { type: String },
		realm: { type: String },
		hero: { type: Number },
		kills: { type: Number },
		deaths: { type: Number },
		assists: { type: Number },
		gpm: { type: Number },
		points: { type: Number },
		win: { type: Boolean },
		score: { type: Number },
		state: { type: String, enum: ['LEFT', 'EMPTY', 'PLAYING'] }
	}],
	players: { type: Number },
	progress: { type: Boolean, default: false },
	recorded: { type: Boolean, default: false },
	recordable: { type: Boolean, default: true },
	ranked: { type: Boolean, default: false },
	balance: { type: Number, default: 1 },
	eventname: { type: String },
	missionPlayed: [String],
	missionWon: [String]
});

var Game = mongoose.model('Game', gameSchema);
module.exports = Game;