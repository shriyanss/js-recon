import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface UsageStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
}

// Rough pricing per 1M tokens (input / output)
const PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "gpt-4.1-nano": { input: 0.1, output: 0.4 },
    "gpt-4.1": { input: 2.0, output: 8.0 },
    "claude-sonnet-4-20250514": { input: 3, output: 15 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
};

const DEFAULT_PRICING = { input: 1, output: 3 };

export class SessionUsage {
    private stats: UsageStats = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
    private model: string;

    constructor(model: string) {
        this.model = model;
    }

    addUsage(promptTokens: number, completionTokens: number): void {
        this.stats.promptTokens += promptTokens;
        this.stats.completionTokens += completionTokens;
        this.stats.totalTokens += promptTokens + completionTokens;

        const pricing = PRICING[this.model] || DEFAULT_PRICING;
        this.stats.estimatedCost =
            (this.stats.promptTokens / 1_000_000) * pricing.input +
            (this.stats.completionTokens / 1_000_000) * pricing.output;
    }

    getStats(): UsageStats {
        return { ...this.stats };
    }

    formatCost(): string {
        const s = this.stats;
        return [
            chalk.cyan(`Model: ${this.model}`),
            `Prompt tokens:     ${s.promptTokens.toLocaleString()}`,
            `Completion tokens: ${s.completionTokens.toLocaleString()}`,
            `Total tokens:      ${s.totalTokens.toLocaleString()}`,
            chalk.green(`Estimated cost:    $${s.estimatedCost.toFixed(6)}`),
        ].join("\n");
    }
}

export interface LLMProvider {
    chat(messages: ChatMessage[]): Promise<{ content: string; promptTokens: number; completionTokens: number }>;
    name: string;
}

export class OpenAIProvider implements LLMProvider {
    private client: OpenAI;
    private model: string;
    name = "openai";

    constructor(apiKey: string, model: string) {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async chat(messages: ChatMessage[]) {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => ({ role: m.role, content: m.content })),
                temperature: 0.3,
            });

            const content = response.choices[0]?.message?.content || "";
            const usage = response.usage;
            return {
                content,
                promptTokens: usage?.prompt_tokens || 0,
                completionTokens: usage?.completion_tokens || 0,
            };
        } catch (err: any) {
            throw new Error(`OpenAI API error: ${err.message}`);
        }
    }
}

export class AnthropicProvider implements LLMProvider {
    private client: Anthropic;
    private model: string;
    name = "anthropic";

    constructor(apiKey: string, model: string) {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async chat(messages: ChatMessage[]) {
        try {
            // Anthropic requires system message separate from messages
            const systemMsg = messages.find((m) => m.role === "system");
            const chatMsgs = messages
                .filter((m) => m.role !== "system")
                .map((m) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                }));

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                system: systemMsg?.content || "",
                messages: chatMsgs,
            });

            const content = response.content
                .filter((block) => block.type === "text")
                .map((block: any) => block.text)
                .join("");

            return {
                content,
                promptTokens: response.usage?.input_tokens || 0,
                completionTokens: response.usage?.output_tokens || 0,
            };
        } catch (err: any) {
            throw new Error(`Anthropic API error: ${err.message}`);
        }
    }
}

/**
 * Creates the appropriate LLM provider based on configuration.
 */
export const createProvider = (provider: "openai" | "anthropic", apiKey: string, model: string): LLMProvider => {
    if (provider === "anthropic") {
        return new AnthropicProvider(apiKey, model);
    }
    return new OpenAIProvider(apiKey, model);
};

/**
 * Lists available models for a given provider.
 */
export const listModels = async (provider: "openai" | "anthropic", apiKey: string): Promise<string[]> => {
    if (provider === "openai") {
        return [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4.1-nano",
            "o1",
            "o1-mini",
            "o3-mini",
        ];
    } else {
        return [
            "claude-sonnet-4-20250514",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ];
    }
};

/**
 * Auto-detects a default model based on the provider.
 */
export const getDefaultModel = (provider: "openai" | "anthropic"): string => {
    return provider === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022";
};
