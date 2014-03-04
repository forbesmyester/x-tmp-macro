# x-tmp-macro

A hacky node.js script that allows storing and execution of temporary macros within the Linux X Windows environment

## Requirements

You must have `xmacro` and `xdotool` installed within your $PATH.

## Usage:
    index.js create: Starts a xmacro recording process saving the temporary play.
    index.js transform: Takes STDIN input from a `xmacrorec2` file and converts it into a series of `xdotool` statements which is outputted to STDOUT.
    index.js run [name]: Reads a stored play, transforms the contents using `index.js transform` and runs it.
    index.js save [name]: Saves the temporary play into the play name specified.
