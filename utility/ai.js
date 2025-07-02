import OpenAI from "openai";
import { Ollama } from 'ollama';
import * as globals from "./globals.js";

const openai_client = new OpenAI({ apiKey: globals.getOpenaiApiKey() });
const ollama_client = new Ollama({
  host: 'http://127.0.0.1:11434',
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
        const completion = await client.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
            model: model || "gpt-3.5-turbo",
        });
        return completion.choices[0].message.content;
    }

    if (provider === "ollama") {
        const response = await client.chat({
            model: model || 'llama2',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
        return response.message.content;
    }
}

export { ai, openai_client, ollama_client, getCompletion };