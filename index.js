(function() {

/* global process:false */

"use strict";

var modifiers = [
	'Shift_L',
	'Control_L',
	'Alt_L',
	'Super_L',
	'ISO_Level3_Shift',
	'Shift_R'
];

var current_modifiers = [];
var codify_line = function(line) {
	
	var is_key_down = function(line) {
		return line.match(/^KeyStrPress/) ? true : false;
	};
	
	var is_key_up = function(line) {
		return line.match(/^KeyStrRelease/) ? true : false;
	};
	
	var get_key = function(line) {
		return line.split(' ')[1];
	};
	
	var is_modifier_key = function(key) {
		return (modifiers.indexOf(key) > -1) ? true : false;
	};
	
	var filter_out_key = function(key, ar) {
		return ar.filter(function(mk) {
			if (mk != key) { return true; }
			return false;
		});
	};
	
	var key;
	
	key = get_key(line);
	if (!is_key_down(line) && !is_key_up(line)) { return false; }
	if (is_modifier_key(key)) {
		if (is_key_down(line)) {
			current_modifiers.push(key);
		} else {
			current_modifiers = filter_out_key(key, current_modifiers);
		}
		return false;
	}
	if (is_key_down(line)) {
		return {
			modifiers: JSON.parse(JSON.stringify(current_modifiers)),
			key: key
		};
	}
	return false;
};

var map_to_xdotool_script = function(codified) {
	if (codified === false) { return ''; }
	var ks = codified.modifiers.concat([codified.key]);
	return 'xdotool key --clearmodifiers --delay 1 ' + ks.join('+') + "\n";
};

var current_line = '';
process.stdin.resume();
process.stdin.on('data', function(data) {
	var lines = data.toString().split("\n"),
		i, l;
	
	for (i=0, l=lines.length; i<l ; i++) {
		current_line = current_line + lines[i];
		process.stdout.write(
			map_to_xdotool_script(codify_line(current_line))
		);
		if (i !== lines.length-1) {
			current_line = '';
		}
	}
});

}());
