const helpMenu = {
    help: "Show this help menu",
    exit: "Exit the interactive mode (or press escape twice)",
    clear: "Clear the output box",
    list: "Usage: list <option>\n  fetch: List functions that contain fetch instances\n  all:   List all functions\n  nav:   List navigation history",
    go: "Usage: go <option>\n  to <functionID>: Go to a specific function\n  back:          Go back to the previous function\n  ahead:         Go to the next function",
    set: "Usage: set <option> <value>\n  funcwritefile <filename>: Set file to write function code to",
    trace: "Usage: trace <functionName>\n  Traces imports for a function",
};

export { helpMenu };
