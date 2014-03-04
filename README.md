# x-tmp-macro

A collection of script that allows storing and execution of temporary macros within the Linux X Windows environment

## Requirements

You must have `xmacro` and `xdotool` installed within your $PATH.

## Scripts

**x-tmp-macro-record:** Starts a xmacro recording process saving the contents to `/tmp/x-tmp-macro`.

**index.js:** Takes STDIN input from a `xmacrorec2` file and converts it into a series of `xdotool` statements which is outputted to STDOUT.

**x-tmp-macro-play [filename]:** Takes the contents of an xmacro file from `filename` (defaults to `/tmp/x-tmp-macro`) which is then transformed using `index.js` and then executed using `xdotool`.
