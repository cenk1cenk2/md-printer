# md-printer

## Description

Prints a PDF file from a Markdown document with some themes for myself.

<!-- toc -->

- [md-printer](#md-printer)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @cenk1cenk2/md-printer
$ md-printer COMMAND
running command...
$ md-printer (--version)
@cenk1cenk2/md-printer/1.0.0 linux-x64 node-v16.18.0
$ md-printer --help [COMMAND]
USAGE
  $ md-printer COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`md-printer FILE [OUTPUT]`](#md-printer-file-output)
- [`md-printer help [COMMAND]`](#md-printer-help-command)

## `md-printer FILE [OUTPUT]`

Generates a PDF from the given markdown file with the selected HTML template.

```
USAGE
  $ md-printer [FILE] [OUTPUT] [-t <value>] [-T <value>] [-w] [-d]

ARGUMENTS
  FILE    Markdown file to be processed.
  OUTPUT  Output file that will be generated. Overwrites the one define in front-matter.

FLAGS
  -T, --title=<value>     Overwrite document title.
  -d, --dev               Run with Chrome browser instead of publishing the file.
  -t, --template=<value>  [default: default] HTML template for the generated PDF file.
  -w, --watch             Watch the changes on the given file.

DESCRIPTION
  Generates a PDF from the given markdown file with the selected HTML template.
```

## `md-printer help [COMMAND]`

Display help for md-printer.

```
USAGE
  $ md-printer help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for md-printer.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.17/src/commands/help.ts)_

<!-- commandsstop -->
