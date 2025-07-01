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

// map
export let ai = undefined;
export let openaiApiKey = undefined;
export let aiModel = "gpt-4o-mini";
export const setAi = (value) => { ai = value; };
export const setOpenaiApiKey = (value) => { openaiApiKey = value; };
export const getAi = () => { return ai; };
export const getOpenaiApiKey = () => { return openaiApiKey; };
export const getAiModel = () => { return aiModel; };
export const setAiModel = (value) => { aiModel = value; };
