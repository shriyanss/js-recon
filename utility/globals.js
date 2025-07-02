// api gateway
export let apiGatewayConfigFile = "";
export let useApiGateway = false;
export const setApiGatewayConfigFile = (file) => { apiGatewayConfigFile = file; };
export const setUseApiGateway = (value) => { useApiGateway = value; };

// response cache
export let disableCache = false;
export let respCacheFile = ".resp_cache.json";
export const setDisableCache = (value) => { disableCache = value; };
export const setRespCacheFile = (file) => { respCacheFile = file; };
export const getDisableCache = () => { return disableCache; };
export const getRespCacheFile = () => { return respCacheFile; };

// auto execute code
export let yes = false;
export const setYes = (value) => { yes = value; };
export const getYes = () => { return yes; };

// AI
export let ai = undefined;
export let openaiApiKey = undefined;
export let aiModel = "gpt-4o-mini";
export let aiServiceProvider = "openai";
export let aiThreads = 5;
export const setAi = (value) => { ai = value; };
export const setOpenaiApiKey = (value) => { openaiApiKey = value; };
export const getAi = () => { return ai; };
export const getOpenaiApiKey = () => { return openaiApiKey; };
export const getAiModel = () => { return aiModel; };
export const setAiModel = (value) => { aiModel = value; };
export const setAiThreads = (value) => { aiThreads = value; };
export const getAiThreads = () => { return aiThreads; };
export const setAiServiceProvider = (value) => { aiServiceProvider = value; };
export const getAiServiceProvider = () => { return aiServiceProvider; };

// tech
export let tech = undefined;
export const setTech = (value) => { tech = value; };
export const getTech = () => { return tech; };
