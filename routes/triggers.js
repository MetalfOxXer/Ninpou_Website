'use strict';

var express = require('express');
var router = express.Router();
var Alias = require('../models/Alias');

router.get('/', async function(req, res) {
	var aliases = await Alias.find({});
	var customTitles = "";
	aliases.forEach(function(alias) {
		if (alias.title) {
			if (customTitles == "") {
				customTitles += "\t\t\tif ";
			} else {
				customTitles += "\t\t\telseif ";
			}
			var condition = "";
			alias.alias.forEach(function(wc3alias) {
				if (condition != "") condition += "or ";
				condition += "StringCase(GetPlayerName(Player(i)), false) ==  \"" + wc3alias.toLowerCase() + "|r\" ";
			});
            var titleWithBrackets = alias.title.replace("\'", "");
            if (titleWithBrackets.startsWith("|")) {
                titleWithBrackets = titleWithBrackets.substring(0, 10) + "[" + titleWithBrackets.substring(10) + "]";
            } else {
                titleWithBrackets = "[" + titleWithBrackets + "]";
            }
			customTitles += condition + "then<br />\t\t\t\tset udg_strings02[i + 1] = \"" + titleWithBrackets + "\"<br/>";
		}
	});
	customTitles += "\t\t\tendif\r\n";
	var str = 
`<pre>struct BotTrigger extends array <br/>\
<br/>\
	public static method actions takes nothing returns nothing <br/>\
{customTitles}<br/>\
	endmethod<br/>\
	<br/>\
	public static method onInit takes nothing returns nothing<br/>\
		call TimerStart(NewTimer(), 6.0, false, function thistype.actions)<br/>\
	endmethod<br/>\
<br/>\
endstruct</pre>`.replace("{customTitles}", customTitles);
	return res.send(str);
});

module.exports = router;
