import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { PuppeteerNode } from "puppeteer";

(puppeteerExtra as any).use(StealthPlugin());

export default puppeteerExtra as unknown as PuppeteerNode;
