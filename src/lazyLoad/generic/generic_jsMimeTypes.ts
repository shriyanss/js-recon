// RFC 9239 registers text/javascript as the current type; RFC 4329's application/javascript
// and application/ecmascript are IANA-registered but marked obsolete in its favor.
// Legacy variants are kept for defensive matching against older/misconfigured servers.
export const JS_CONTENT_TYPES = new Set([
    "text/javascript",
    "application/javascript",
    "application/ecmascript",
    "text/ecmascript",
    "application/x-javascript",
    "text/x-javascript",
    "text/jscript",
]);

export const isJsContentType = (contentType: string | null | undefined): boolean => {
    if (!contentType) return false;
    const mime = contentType.split(";")[0].trim().toLowerCase();
    return JS_CONTENT_TYPES.has(mime);
};
