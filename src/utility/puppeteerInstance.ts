import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer";
import type { PuppeteerNode } from "puppeteer";

// Use addExtra to pass the ESM puppeteer directly instead of letting puppeteer-extra
// call require('puppeteer') internally. This avoids Node.js ExperimentalWarning about
// synchronous require() of ESM modules, which prints on every run with newer Node.js
// (e.g. Homebrew's node).
const puppeteerExtra = addExtra(puppeteer as any);
puppeteerExtra.use(StealthPlugin());

export default puppeteerExtra as unknown as PuppeteerNode;
