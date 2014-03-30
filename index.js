(function() {

/* global process:false */

"use strict";

var STORAGE_LOCATION = '/tmp',
	DEFAULT_RECORD_NAME = '_-temporary',
	LOG_LOCATION = STORAGE_LOCATION + '/x-tmp-macro.log',
	TMP_RUN_FILE = '/tmp/x-tmp-macro.run',
    EXTENSION = 'x-tmp-macro',
	DEFAULT_DELAY_TIME = 12;

var current_modifiers = [];
var map_to_xdotool_script = function(current_line, delay) {

    var codify_line = function(line) {

        var modifiers = [
            'Shift_L',
            'Control_L',
            'Alt_L',
            'Super_L',
            'Hyper_L',
            'Shift_R',
            'Control_R',
            'Alt_R',
            'Super_R',
            'Hyper_R',
            'ISO_Level3_Shift'
        ];

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

    var codified = codify_line(current_line);

	if (codified === false) { return ''; }
	var ks = codified.modifiers.concat([codified.key]);
	return 'xdotool key --clearmodifiers --delay ' + delay + ' ' + ks.join('+') + "\n";
};

var transform = function(method, delay) {

	if (delay === undefined) { delay = 1; }
	var current_line = '';
	process.stdin.resume();
	process.stdin.on('data', function(data) {
		var lines = data.toString().split("\n"),
			i, l;
		
		for (i=0, l=lines.length; i<l ; i++) {
			current_line = current_line + lines[i];
			process.stdout.write(
				map_to_xdotool_script(current_line, delay)
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
		"    " + __filename.replace(/.*\//,'') + " transform [method] [delay]: Takes STDIN input from a `xmacrorec2` file and converts it into a series of `xdotool` statements which is outputted to STDOUT.",
		"    " + __filename.replace(/.*\//,'') + " run [method] [name] [delay]: Reads a stored play, transforms the contents using `index.js transform` and runs it.",
		"    " + __filename.replace(/.*\//,'') + " save [name]: Saves the temporary play into the play name specified."
		].join("\n");
	console.log(help);
};

var construct_path_from_play_name = function(play_name) {
	if (play_name.indexOf('-') === -1) {
		play_name = '_-' + play_name;
	}

	return STORAGE_LOCATION + "/" + play_name + '.' + EXTENSION;
};

var run = function(method, play_name, delay, next) {
	
	var commands = [
			// 'killall xmacrorec2',
			'cat PLAY_LOCATION | node THIS_SCRIPT transform METHOD DELAY > TMP_RUN_FILE',
			'chmod +x TMP_RUN_FILE',
			'TMP_RUN_FILE',
			//'rm TMP_RUN_FILE'
		],
		fs = require('fs');

	if (delay === undefined) { delay = DEFAULT_DELAY_TIME; }
	
	if (!fs.existsSync(construct_path_from_play_name(play_name))) {
		fs.writeFileSync(
				LOG_LOCATION,
				"your play_name (" + play_name + ") does not exist."
			);
		return;
	}

	var mapper = function(lineTemplate) {
		var command = lineTemplate.replace(
			/PLAY_LOCATION/, construct_path_from_play_name(play_name)
		);
		command = command.replace(/THIS_SCRIPT/, __filename);
		command = command.replace(/TMP_RUN_FILE/, TMP_RUN_FILE);
		command = command.replace(/DELAY/, delay);
		command = command.replace(/METHOD/, method);
		return command;
	};

	var q = require('async').queue(function(command, next) {
		/* global __filename: false */
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
		
	q.drain = function() {
		if (next !== undefined) { return next(null); }
	};
	
	for (var i=0; i<commands.length; i++) {
		q.push(mapper(commands[i]));
	}
};

var create = function(next) {
	var cmd = 'xmacrorec2 -k 127 > ' + construct_path_from_play_name(DEFAULT_RECORD_NAME);
	
	require('child_process').exec(cmd, function(err) {
		if (err) {
			return next(err);
		}
		next(null);
	});
};

var escapeRegExp = function(string){
	return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};

var save = function(play_name, cb) {
	
	var fs = require('fs'),
		tmp = STORAGE_LOCATION + "/" + DEFAULT_RECORD_NAME + '.' + EXTENSION;
	
	if (!fs.existsSync(tmp)) {
        if (cb !== undefined) {
            cb([1, "there is no tempoary play to save."]);
        }
		return;
	}
    
    var re = /^(([^-]{1,2})\-)?([a-zA-Z0-9 ]+)$/;
    if (!play_name.match(re)) {
        return cb([2, "Invalid play name (must match /^(([^-]{1,2})\\-)?([a-zA-Z0-9 ]+)$/)"]);
    }
	
	fs.writeFileSync(
		construct_path_from_play_name(play_name),
		fs.readFileSync(tmp)
	);
};

var get_position_argument = function(name, position, the_default, process_arguments) {

	var r = the_default,
		fs = require('fs');
	
	if (process_arguments.length > position) {
		r = process_arguments[position];
	}
	
	if (r.match(/\//)) {
		fs.writeFileSync(
				LOG_LOCATION,
				"your " + name + " (" + r + ") should not include a '/'."
			);
		return;
	}
	
	return r;
	
};

var escape_shell_arg = function(arg) {
    return '"'+arg.replace(/(["\s'$`\\])/g,'\\$1')+'"';
};

var ui_get_play_name = function(title, message, entry, next) {
    var cmd = 'zenity --entry --title="' + escape_shell_arg(title) + '"  --text=" ' + escape_shell_arg(message) + ':"  --entry-text "' + escape_shell_arg(entry) +'"';
    var exec = require('child_process').exec;
    exec(cmd, function(e, stdout) {
        if (e) { return next(e); }
		return next(null, stdout.trim());
    });
};

var ui_save = function(next) {
	ui_get_play_name('Name your Macro', 'Enter a name for your macro', 'New Macro Name', function(e, inp) {
		if (e) { return next(e); }
		if (!inp.trim()) { return next(null); }
		save(inp, next);
	});
};

var ui_list = function(title, message, next) {
	
    var items = require('fs').readdirSync(STORAGE_LOCATION).filter(function(n) {
		return n.match(new RegExp(escapeRegExp(EXTENSION) + '$'));
	}).map(function(n) {
        return n.replace(new RegExp("\\." + escapeRegExp(EXTENSION) + '$'), '');
	}).filter(function(n) {
		return (n.split('-').length == 2);
	}).map(function(n) {
		if (n.split('-')[0] == '_') {
			n = n.substr(1);
		}
		return n.split('-').reverse();
	}).sort(function(a, b) {
		return a.join('-') < b.join('-') ? -1 : 1;
	});
	
	var exec = require('child_process').exec,
		cmd = 'zenity --list --separator="*" --title="' + title + '" --column="Name" --column="Shortcut" ' + 
			items.map(function(item) {
				return item.map(escape_shell_arg).join(' ');
			}).join(' ');
	
	exec(cmd, function(e, stdout) {
		var items;
		if (e) {
			if (e.hasOwnProperty('killed') && (e.killed === false)) {
				return next(null, null);
			}
			return next(e);
		}
		items = stdout.trim().split('*');
		return next(null, items.length ? items[0] : null);
	});
	
};

var resolve_play_description_to_filenames = function(play_name) {
	return require('fs').readdirSync(STORAGE_LOCATION).filter(function(n) {
		return n.match(new RegExp(EXTENSION + '$'));
	}).filter(function(n) {
		var resrc = escapeRegExp('-') + play_name + '\\.' + escapeRegExp(EXTENSION) + '$';
		return n.match(new RegExp(resrc));
	}).map(function(n) {
		return STORAGE_LOCATION + '/' + n;
	});
};

var ui_delete = function(title, message, next) {
	ui_list(title, message, function(e, item) {
		if (item === null) { return next(null); }
		var items = resolve_play_description_to_filenames(item);
		items.forEach(function(item) {
			require('fs').unlinkSync(item);
		});
		return next(null);
	});
};
	
var ui_move = function(select_title, select_message, input_title, input_message, input_placeholder, next) {
	ui_list(select_title, select_message, function(e, item) {
		if (e) { return next(e); }
		if (item === null) { return next(null); }
		ui_get_play_name(input_title, input_message, input_placeholder, function(e, play_name) {
			if (e) { return next(e); }
			if (!play_name.trim()) { return next(null); }
			var items = resolve_play_description_to_filenames(item);
			items.forEach(function(item) {
				var fs = require('fs');
				fs.writeFileSync(
					construct_path_from_play_name(play_name),
					item
				);
				fs.unlinkSync(item);
			});
			return next(null);
		});
	});
};

var filename_to_play_name = function(filename) {
	return filename.replace(/.*\//, '').replace(new RegExp('\\.' + EXTENSION), '');
};

var ui_run = function(select_title, select_message, next) {
	ui_list(select_title, select_message, function(e, item) {
		if (e) { return next(e); }
		if (item === null) { return next(null); }
		var items = resolve_play_description_to_filenames(item);
		var done = false;
		items.forEach(function(item) {
			run('xdotool', filename_to_play_name(item), DEFAULT_DELAY_TIME, function() {
				if (done) { return; }
				done = true;
				return next(null);
			});
		});
	});
};

var get_play_name = get_position_argument.bind(this, 'play name', 4, DEFAULT_RECORD_NAME);
var get_method_name = get_position_argument.bind(this, 'method', 3, 'xdotool');

var errorDisplay = function(e) {
	if (e) {
		require('child_process').exec('zenity --error --text=' + (escape_shell_arg(e[0] + ': ' + e[1])), function() {});
	}
};

var errorLog = function(e) {
	require('fs').writeFileSync(
		LOG_LOCATION,
		JSON.stringify(e)
	);
};

var ui_create = function(next) {
	create(function(e) {
		if (e) { return next(e); }
		ui_save(next);
	});
};

var operations;

var ui_menu = function(title, col_header, next) {
	var exec = require('child_process').exec,
		cmd = 'zenity --list --separator="*" --title=' + escape_shell_arg(title) + 
			' --column=' + escape_shell_arg(col_header) + ' ' + 
			'Run Create Move Delete';
	exec(cmd, function(e, stdout) {
		var item;
		if (e) {
			if (e.hasOwnProperty('killed') && (e.killed === false)) {
				return next(null, null);
			}
			return next(e);
		}
		item = stdout.trim().split('*').length ? stdout.trim().split('*').shift() : null;
		if (item === null) {
			return next(null);
		}
		operations['ui-' + item.toLowerCase()](next);
	});
};

operations = {
	transform: transform.bind(this, get_method_name(process.argv), get_play_name(process.argv)),
	create: create.bind(this, errorLog),
	run: run.bind(this, get_method_name(process.argv), get_play_name(process.argv)),
	save: save.bind(this, get_play_name(process.argv), function(e) { console.log(e.join(': ')); }),
    'ui-save': ui_save.bind(this, errorDisplay),
    'ui-list': ui_list.bind(this, 'These are your macros', '', errorDisplay),
	'ui-delete': ui_delete.bind(this, 'Select an item to delete', '', errorDisplay),
	'ui-move': ui_move.bind(this, 'Select item to move', '', 'To Where', 'To where do you want to move it', '', errorDisplay),
	'ui-run': ui_run.bind(this, 'Select an item to run', 'To run an item select it from the list below', errorDisplay),
	'ui-create': ui_create.bind(this, errorDisplay),
	'ui-menu': ui_menu.bind(this, 'Main Menu', '', errorDisplay)
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

operations[process.argv[2]].apply(this, process.argv.slice(5));

}());
