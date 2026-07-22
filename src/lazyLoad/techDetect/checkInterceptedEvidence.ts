import { isJsContentType } from "../generic/generic_jsMimeTypes.js";

/**
 * A framework-shaped intercepted URL (e.g. matching /_nuxt/, /_next/) is only real
 * detection evidence if its response actually looks like JS — a path-shape match alone
 * isn't enough, since an error/maintenance page served at that path shape would
 * otherwise be enough to mis-fingerprint the whole target.
 */
export const isValidInterceptedJsEvidence = (
    status: number,
    contentType: string | null | undefined,
    body: string
): boolean => {
    if (status < 200 || status >= 300) return false;
    if (!isJsContentType(contentType)) return false;
    const trimmed = body.trimStart().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) return false;
    return true;
};
