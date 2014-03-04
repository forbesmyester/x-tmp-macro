(function() {

/* global process:false */

"use strict";

var STORAGE_LOCATION = '/tmp',
	DEFAULT_RECORD_NAME = 'temporary',
	LOG_LOCATION = STORAGE_LOCATION + '/x-tmp-macro.log',
	TMP_RUN_FILE = '/tmp/x-tmp-macro.run';

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

var transform = function() {
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
};

var print_help = function() {
	/* global console: false, __filename */
	var help = [
		"Usage:",
		"    " + __filename.replace(/.*\//,'') + " create: Starts a xmacro recording process saving the temporary play.",
		"    " + __filename.replace(/.*\//,'') + " transform: Takes STDIN input from a `xmacrorec2` file and converts it into a series of `xdotool` statements which is outputted to STDOUT.",
		"    " + __filename.replace(/.*\//,'') + " run [name]: Reads a stored play, transforms the contents using `index.js transform` and runs it.",
		"    " + __filename.replace(/.*\//,'') + " save [name]: Saves the temporary play into the play name specified."
		].join("\n");
	console.log(help);
};

var construct_path_from_play_name = function(play_name) {
	return STORAGE_LOCATION + "/" + play_name + '.x-tmp-macro';
};

var run = function(play_name) {
	
	var commands = [
			// 'killall xmacrorec2',
			'cat PLAY_LOCATION | node THIS_SCRIPT transform > TMP_RUN_FILE',
			'chmod +x TMP_RUN_FILE',
			'TMP_RUN_FILE',
			'rm TMP_RUN_FILE'
		],
		fs = require('fs');
	
	if (!fs.existsSync(construct_path_from_play_name(play_name))) {
		fs.writeFileSync(
				LOG_LOCATION,
				"your play_name (" + play_name + ") does not exist."
			);
		return;
	}
	
	var q = require('async').queue(function(command, next) {
		/* global __filename: false */
		command = command.replace(
			/PLAY_LOCATION/, construct_path_from_play_name(play_name)
		);
		command = command.replace(/THIS_SCRIPT/, __filename);
		command = command.replace(/TMP_RUN_FILE/, TMP_RUN_FILE);
		require('child_process').exec(command, function(err) {
			if (err) {
				fs.writeFileSync(
					LOG_LOCATION,
					"Command '" + command + "' exited with error " + err
				);
			}
			return next(err);
		});
	});
	
	for (var i=0; i<commands.length; i++) {
		q.push(commands[i]);
	}
};

var create = function() {
	console.log("CREATE");
	var cmd = 'xmacrorec2 -k 9 > ' + construct_path_from_play_name(DEFAULT_RECORD_NAME);
	
	require('child_process').exec(cmd, function(err) {
		if (err) {
			require('fs').writeFileSync(
				LOG_LOCATION,
				"Command '" + cmd + "' exited with error " + err
			);
		}
	});
};

var save = function(play_name) {
	
	var fs = require('fs'),
		tmp = STORAGE_LOCATION + "/" + DEFAULT_RECORD_NAME + '.x-tmp-macro';
	
	if (!fs.existsSync(tmp)) {
		fs.writeFileSync(
				LOG_LOCATION,
				"there is no tempoary play to save."
			);
		return;
	}
	
	fs.writeFileSync(
		construct_path_from_play_name(play_name),
		fs.readFileSync(tmp)
	);
};

var get_play_name = function(process_arguments) {

	var play_name = DEFAULT_RECORD_NAME,
		fs = require('fs');
	
	if (process_arguments.length > 3) {
		play_name = process_arguments[3];
	}
	
	if (play_name.match(/\//)) {
		fs.writeFileSync(
				LOG_LOCATION,
				"your play_name (" + play_name + ") should not include a '/'."
			);
		return;
	}
	
	return play_name;
	
};
	
var operations = {
	transform: transform.bind(this, get_play_name(process.argv)),
	create: create,
	run: run.bind(this, get_play_name(process.argv)),
	save: save.bind(this, get_play_name(process.argv))
};


var valid_operations = (function(operations) {
		var r = [];
		for (var k in operations) { if (operations.hasOwnProperty(k)) {
			r.push(k);
		} }
		return r;
	}(operations));

if (
	valid_operations.indexOf(process.argv[2]) === -1) {
	print_help();
	return;
}

operations[process.argv[2]].apply(process.argv.slice(3));

}());
