// api gateway
export let apiGatewayConfigFile = "";
export let useApiGateway = false;
export const setApiGatewayConfigFile = (file) => {
    apiGatewayConfigFile = file;
};
export const setUseApiGateway = (value) => {
    useApiGateway = value;
};

// response cache
export let disableCache = false;
export let respCacheFile = ".resp_cache.json";
export const setDisableCache = (value) => {
    disableCache = value;
};
export const setRespCacheFile = (file) => {
    respCacheFile = file;
};
export const getDisableCache = () => {
    return disableCache;
};
export const getRespCacheFile = () => {
    return respCacheFile;
};

// auto execute code
export let yes = false;
export const setYes = (value) => {
    yes = value;
};
export const getYes = () => {
    return yes;
};

// AI
export let ai = [];
export let openaiApiKey = "";
export let aiModel = "gpt-4o-mini";
export let aiServiceProvider = "openai";
export let aiThreads = 5;
export let aiEndpoint = undefined;
export const setAi = (value: []) => {
    ai = value;
};
export const setOpenaiApiKey = (value: string) => {
    openaiApiKey = value;
};
export const getAi = () => {
    return ai;
};
export const getOpenaiApiKey = () => {
    return openaiApiKey;
};
export const getAiModel = () => {
    return aiModel;
};
export const setAiModel = (value: string) => {
    aiModel = value;
};
export const setAiThreads = (value: number) => {
    aiThreads = value;
};
export const getAiThreads = () => {
    return aiThreads;
};
export const setAiServiceProvider = (value: string) => {
    aiServiceProvider = value;
};
export const getAiServiceProvider = () => {
    return aiServiceProvider;
};
export const setAiEndpoint = (value: string) => {
    aiEndpoint = value;
};
export const getAiEndpoint = () => {
    return aiEndpoint;
};

// tech
export let tech = "";
export const setTech = (value: string) => {
    tech = value;
};
export const getTech = () => {
    return tech;
};

// mapped
export let openapi = false;
export let openapiOutputFile = "mapped-openapi.json";
export const setOpenapi = (value: boolean) => {
    openapi = value;
};
export const getOpenapi = () => {
    return openapi;
};
export const setOpenapiOutputFile = (value: string) => {
    openapiOutputFile = value;
};
export const getOpenapiOutputFile = () => {
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
}
export let openapiOutput: OpenapiOutputItem[] = [];
export const addOpenapiOutput = (value: OpenapiOutputItem) => {
    openapiOutput.push(value);
};
export const getOpenapiOutput = () => {
    return openapiOutput;
};
