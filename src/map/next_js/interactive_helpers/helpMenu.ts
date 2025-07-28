const helpMenu = {
    help: "Show this help menu",
    exit: "Exit the interactive mode",
    clear: "Clear the output box",
    list: "Usage: list <option>\n  fetch: List functions that contain fetch instances\n  axios: List functions that are axios clients\n  all:   List all functions\n  nav:   List navigation history\n  exportnames <option>: List export names for a chunk\n    <chunkId>: List export names for a specific chunk\n    all: List export names for all chunks\n    nonempty: List export names for all non-empty chunks",
    go: "Usage: go <option>\n  to <functionID>: Go to a specific function\n  back:          Go back to the previous function\n  ahead:         Go to the next function",
    set: "Usage: set <option> <value>\n  funcwritefile <filename>: Set file to write function code to\n  writeimports [true/false]: When using `go *` command, also write all the imports to the file\n  funcdesc <functionId> <description>: Set the description of the provided function ID with provided value",
    trace: "Usage: trace <functionName>\n  Traces imports for a function",
};

export { helpMenu };
