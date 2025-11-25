// API Gateway Configuration
/** Path to the API Gateway configuration file */
export let apiGatewayConfigFile = "";
/** Whether to use API Gateway for requests */
export let useApiGateway = false;

/**
 * Sets the API Gateway configuration file path.
 * @param file - Path to the API Gateway configuration file
 */
export const setApiGatewayConfigFile = (file: string): void => {
    apiGatewayConfigFile = file;
};

/**
 * Enables or disables the use of API Gateway.
 * @param value - Whether to use API Gateway
 */
export const setUseApiGateway = (value: boolean): void => {
    useApiGateway = value;
};

// Response Cache Configuration
/** Whether response caching is disabled */
export let disableCache = false;
/** Path to the response cache file */
export let respCacheFile = ".resp_cache.json";

/**
 * Disables or enables response caching.
 * @param value - Whether to disable caching
 */
export const setDisableCache = (value: boolean): void => {
    disableCache = value;
};

/**
 * Sets the response cache file path.
 * @param file - Path to the response cache file
 */
export const setRespCacheFile = (file: string): void => {
    respCacheFile = file;
};

/**
 * Gets the current cache disable status.
 * @returns Whether caching is disabled
 */
export const getDisableCache = (): boolean => {
    return disableCache;
};

/**
 * Gets the current response cache file path.
 * @returns Path to the response cache file
 */
export const getRespCacheFile = (): string => {
    return respCacheFile;
};

// Sandbox Configuration
/** Whether to disable the browser sandbox */
export let disableSandbox = false;

/**
 * Sets the disable sandbox flag.
 * @param value - Whether to disable the sandbox
 */
export const setDisableSandbox = (value: boolean): void => {
    disableSandbox = value;
};

/**
 * Gets the current disable sandbox status.
 * @returns Whether the sandbox is disabled
 */
export const getDisableSandbox = (): boolean => {
    return disableSandbox;
};

// Auto-execution Configuration
/** Whether to auto-approve code execution */
export let yes = false;

/**
 * Sets the auto-approval flag for code execution.
 * @param value - Whether to auto-approve code execution
 */
export const setYes = (value: boolean): void => {
    yes = value;
};

/**
 * Gets the current auto-approval status.
 * @returns Whether auto-approval is enabled
 */
export const getYes = (): boolean => {
    return yes;
};

// Request Timeout Configuration
/** Request timeout in milliseconds */
export let requestTimeout = 30000;

/**
 * Sets the request timeout value.
 * @param value - Timeout in milliseconds
 */
export const setRequestTimeout = (value: number): void => {
    requestTimeout = value;
};

/**
 * Gets the current request timeout value.
 * @returns Timeout in milliseconds
 */
export const getRequestTimeout = (): number => {
    return requestTimeout;
};

// AI Configuration
/** Array of AI analysis options */
export let ai: string[] = [];
/** OpenAI API key */
export let openaiApiKey = "";
/** AI model to use for analysis */
export let aiModel = "gpt-4o-mini";
/** AI service provider (openai, ollama, etc.) */
export let aiServiceProvider = "openai";
/** Number of AI analysis threads */
export let aiThreads = 5;
/** Custom AI endpoint URL */
export let aiEndpoint: string | undefined = undefined;

/**
 * Sets the AI analysis options.
 * @param value - Array of AI options (e.g., ['description'])
 */
export const setAi = (value: string[]): void => {
    ai = value;
};

/**
 * Sets the OpenAI API key.
 * @param value - OpenAI API key
 */
export const setOpenaiApiKey = (value: string): void => {
    openaiApiKey = value;
};

/**
 * Gets the current AI analysis options.
 * @returns Array of AI options
 */
export const getAi = (): string[] => {
    return ai;
};

/**
 * Gets the OpenAI API key.
 * @returns OpenAI API key
 */
export const getOpenaiApiKey = (): string => {
    return openaiApiKey;
};

/**
 * Gets the current AI model.
 * @returns AI model identifier
 */
export const getAiModel = (): string => {
    return aiModel;
};

/**
 * Sets the AI model to use.
 * @param value - AI model identifier
 */
export const setAiModel = (value: string): void => {
    aiModel = value;
};

/**
 * Sets the number of AI analysis threads.
 * @param value - Number of threads
 */
export const setAiThreads = (value: number): void => {
    aiThreads = value;
};

/**
 * Gets the number of AI analysis threads.
 * @returns Number of threads
 */
export const getAiThreads = (): number => {
    return aiThreads;
};

/**
 * Sets the AI service provider.
 * @param value - Service provider identifier
 */
export const setAiServiceProvider = (value: string): void => {
    aiServiceProvider = value;
};

/**
 * Gets the AI service provider.
 * @returns Service provider identifier
 */
export const getAiServiceProvider = (): string => {
    return aiServiceProvider;
};

/**
 * Sets a custom AI endpoint URL.
 * @param value - Custom endpoint URL
 */
export const setAiEndpoint = (value: string): void => {
    aiEndpoint = value;
};

/**
 * Gets the custom AI endpoint URL.
 * @returns Custom endpoint URL or undefined
 */
export const getAiEndpoint = (): string | undefined => {
    return aiEndpoint;
};

// Technology Detection
/** Detected technology stack */
export let tech = "";

/**
 * Sets the detected technology stack.
 * @param value - Technology identifier (e.g., 'next', 'nuxt', 'svelte')
 */
export const setTech = (value: string): void => {
    tech = value;
};

/**
 * Gets the currently detected technology stack.
 * @returns Technology identifier
 */
export const getTech = (): string => {
    return tech;
};

// OpenAPI Configuration
/** Whether to generate OpenAPI specifications */
export let openapi = false;
/** Output file path for OpenAPI specifications */
export let openapiOutputFile = "mapped-openapi.json";

/**
 * Enables or disables OpenAPI specification generation.
 * @param value - Whether to generate OpenAPI specs
 */
export const setOpenapi = (value: boolean): void => {
    openapi = value;
};

/**
 * Gets the OpenAPI generation status.
 * @returns Whether OpenAPI generation is enabled
 */
export const getOpenapi = (): boolean => {
    return openapi;
};

/**
 * Sets the OpenAPI output file path.
 * @param value - Path to the OpenAPI output file
 */
export const setOpenapiOutputFile = (value: string): void => {
    openapiOutputFile = value;
};

/**
 * Gets the OpenAPI output file path.
 * @returns Path to the OpenAPI output file
 */
export const getOpenapiOutputFile = (): string => {
    return openapiOutputFile;
};

// openapi output
export interface OpenapiOutputItem {
    url: string;
    method: string;
    path: string;
    headers: {
        [key: string]: string;
    };
    body: string;
    chunkId: string;
    functionFile: string;
    functionFileLine: number;
    crossChunkParams?: Array<{ chunkId: string; params: string; file: string; line: number }>;
}
/** Array of OpenAPI output items */
export let openapiOutput: OpenapiOutputItem[] = [];

/**
 * Adds an item to the OpenAPI output collection.
 * @param value - OpenAPI output item to add
 */
export const addOpenapiOutput = (value: OpenapiOutputItem): void => {
    openapiOutput.push(value);
};

/**
 * Gets the current OpenAPI output collection.
 * @returns Array of OpenAPI output items
 */
export const getOpenapiOutput = (): OpenapiOutputItem[] => {
    return openapiOutput;
};

// OpenAPI Chunk Tag Configuration
/** Whether to add chunk ID tags to OpenAPI specifications */
export let openapiChunkTag = false;

/**
 * Enables or disables chunk ID tags in OpenAPI specs.
 * @param value - Whether to add chunk ID tags
 */
export const setOpenapiChunkTag = (value: boolean): void => {
    openapiChunkTag = value;
};

/**
 * Gets the chunk tag configuration status.
 * @returns Whether chunk ID tags are enabled
 */
export const getOpenapiChunkTag = (): boolean => {
    return openapiChunkTag;
};
