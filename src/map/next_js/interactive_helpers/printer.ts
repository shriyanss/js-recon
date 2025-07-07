import { highlight } from "cli-highlight";
import fs from "fs";

// Function to print function code with syntax highlighting
const printFunction = (outputBox, funcCode, funcDesc, funcWriteFile) => {
    const rawText = `/**\n* ${funcDesc}\n*/\n${funcCode}`;
    const highlighted = highlight(rawText, {
        language: "javascript",
        ignoreIllegals: true,
        theme: undefined, // This makes cli-highlight use ANSI colors
    });

    outputBox.setContent(highlighted); // << use setContent instead of setText

    if (funcWriteFile) {
        fs.writeFileSync(funcWriteFile, rawText); // Save raw (non-colored) version to file
    }
};

export { printFunction };
