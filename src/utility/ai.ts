import OpenAI from "openai";
import { Ollama } from "ollama";
import * as globals from "./globals.js";

const openai_client = new OpenAI({
    baseURL: globals.getAiEndpoint() || "https://api.openai.com/v1",
    apiKey: globals.getOpenaiApiKey(),
});
const ollama_client = new Ollama({
    host: globals.getAiEndpoint() || "http://127.0.0.1:11434",
});

const ai = async () => {
    let returnVal = { client: undefined, model: globals.getAiModel() };
    const provider = globals.getAiServiceProvider();

    if (provider === "openai") {
        returnVal.client = openai_client;
    } else if (provider === "ollama") {
        returnVal.client = ollama_client;
    }

    return returnVal;
};

async function getCompletion(prompt, systemPrompt = "You are a helpful assistant.") {
    const { client, model } = await ai();
    const provider = globals.getAiServiceProvider();

    if (!client) {
        throw new Error(`AI service provider "${provider}" is not supported or configured.`);
    }

    if (provider === "openai") {
        const completion = await client.responses.create({
            input: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            model: model || "gpt-4o-mini",
            temperature: 0.1,
        });
        return completion?.output?.[0]?.content?.[0]?.text || "none";
    }

    if (provider === "ollama") {
        const response = await ollama_client.chat({
            model: model || "llama3.1",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            options: {
                temperature: 0.1,
            },
        });
        return response.message.content || "none";
    }
}

export { ai, openai_client, ollama_client, getCompletion };
