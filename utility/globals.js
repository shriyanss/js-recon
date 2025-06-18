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
