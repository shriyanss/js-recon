# Interactive Mode for Next.js Maps

The interactive mode for Next.js maps provides a terminal-based interface to explore and analyze the functions within your Next.js application. This guide will walk you through the features and commands available in this mode.

## Getting Started

To launch the interactive mode, run the following command:

```bash
js-recon map <other options> -i
```

## User Interface

The interactive mode interface is composed of three main components:

- **Title Box**: Displays the title "JS Recon Interactive Mode".
- **Output Box**: Shows the output of commands and function information. You can scroll through this box using the arrow keys when it's in focus.
- **Input Box**: This is where you type your commands.

## Keybindings

The following keybindings are available for navigation and control:

| Key             | Description                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `Ctrl+C` or `q` | Exit the interactive mode (when not in the input box). To exit from the input box, press `Esc` first. |
| `i`             | Focus the input box.                                                                                  |
| `o`             | Focus the output box.                                                                                 |
| `Esc`           | When in the input box, focuses the output box.                                                        |
| `Up Arrow`      | In the input box, navigate to the previous command.                                                   |
| `Down Arrow`    | In the input box, navigate to the next command.                                                       |
| `Up Arrow`      | In the output box, scroll up.                                                                         |
| `Down Arrow`    | In the output box, scroll down.                                                                       |

## Commands

Here is a list of available commands and their usage:

### `help`

Displays the help menu with a list of all available commands.

### `exit`

Exits the interactive mode.

### `clear`

Clears the content of the output box.

### `list`

Lists different types of information. Usage: `list <option>`

- `list fetch`: Lists all functions that contain `fetch` instances.
- `list all`: Lists all functions found in the application.
- `list nav`: Lists your function navigation history.

### `go`

Navigates between functions. Usage: `go <option>`

- `go to <functionID>`: Displays the code for a specific function.
- `go back`: Navigates to the previously viewed function.
- `go ahead`: Navigates to the next function in your history.

### `set`

Sets configuration options. Usage: `set <option> <value>`

- `set funcwritefile <filename>`: Update the file location where function code will be written when using the `go to` command.
- `set writeimports [true/false]`: When using `go *` command, also write all the imports of the function to the file
- `set funcdesc <functionId>`: Set the description of the provided function ID with provided value
    - Example: `set funcdesc 1234 This function does something fishy`
    - This will set the description to `This function does something fishy`
    - Note that you don't need to provide the quotes for this. The tool detects the description based on spaces(` `)

### `trace`

Traces the imports for a given function. Usage: `trace <functionName>`
