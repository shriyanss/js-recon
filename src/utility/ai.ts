import OpenAI from "openai";
import { Ollama } from "ollama";
import * as globals from "./globals.js";

/**
 * OpenAI client instance.
 *
 * @remarks
 * This client is used to communicate with the OpenAI API.
 * The base URL and API key are configurable via the
 * `setAiEndpoint` and `setOpenaiApiKey` functions.
 */
const openai_client = new OpenAI({
    baseURL: globals.getAiEndpoint() || "https://api.openai.com/v1",
    apiKey: globals.getOpenaiApiKey(),
});

/**
 * Ollama client instance.
 *
 * @remarks
 * This client is used to communicate with the Ollama API.
 * The host is configurable via the `setAiEndpoint` function.
 */
const ollama_client = new Ollama({
    host: globals.getAiEndpoint() || "http://127.0.0.1:11434",
});

/**
 * Returns an AI client instance based on the configured provider.
 *
 * @returns {Object} An object containing the AI client and the configured model.
 */
const ai = async (): Promise<{ client: OpenAI | Ollama; model: string }> => {
    const model = globals.getAiModel();
    const provider = globals.getAiServiceProvider();

    if (provider === "openai") {
        return { client: openai_client, model };
    }

    if (provider === "ollama") {
        return { client: ollama_client, model };
    }

    throw new Error(`AI service provider "${provider}" is not supported or configured.`);
};

/**
 * Asks an AI service provider to generate text based on a prompt.
 *
 * @param {string} prompt The input prompt describing the desired text output.
 * @param {string} [systemPrompt="You are a helpful assistant."] The system prompt guiding the overall tone and behavior.
 * @returns {Promise<string>} The generated text produced for the prompt.
 */
async function getCompletion(prompt, systemPrompt = "You are a helpful assistant.") {
    const { client, model } = await ai();
    const provider = globals.getAiServiceProvider();

    if (!client) {
        throw new Error(`AI service provider "${provider}" is not supported or configured.`);
    }

    if (provider === "openai") {
        // @ts-ignore
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
