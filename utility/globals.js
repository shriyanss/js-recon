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

// mitmproxy
export let mitm = false;
export let mitmPort = 8585;
export let mitmParseScript = ".mitm_parser.py";
export const setMitm = (value) => { mitm = value; };
export const getMitm = () => { return mitm; };

export const setMitmPort = (port) => { mitmPort = port; };
export const getMitmPort = () => { return mitmPort; };

export const setMitmParseScript = (script) => { mitmParseScript = script; };
export const getMitmParseScript = () => { return mitmParseScript; };

// server to receive requests from mitmproxy
export let mitmParseServerPort = 8686;
export const setMitmParseServerPort = (port) => { mitmParseServerPort = port; };
export const getMitmParseServerPort = () => { return mitmParseServerPort; };
