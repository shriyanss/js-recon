import chalk from "chalk";
import * as cheerio from 'cheerio';

// returns data in format { detected: "<name of the framework>", evidence: "<evidence>" }
const checkNextJS = async ($) => {
  let detected = false;
  let evidence = "";
  // iterate through each HTML tag, and file tag value that starts with `/_next/`
  $("*").each((_, el) => {
    const tag = $(el).get(0).tagName;

    // check the value of three attributes
    const src = $(el).attr("src");
    const srcSet = $(el).attr("srcset");
    const imageSrcSet = $(el).attr("imageSrcSet");

    if (src || srcSet || imageSrcSet) {
      if (src && src.startsWith("/_next/")) {
        detected = true;
        evidence = `${tag} :: ${src}`;
      } else if (srcSet && srcSet.startsWith("/_next/")) {
        detected = true;
        evidence = `${tag} :: ${srcSet}`;
      } else if (imageSrcSet && imageSrcSet.startsWith("/_next/")) {
        detected = true;
        evidence = `${tag} :: ${imageSrcSet}`;
      }
    }
  });

  return { detected, evidence };
};

const frameworkDetect = async (url) => {
  console.log(chalk.cyan("[i] Detecting front-end framework"));

  // get the page source
  const res = await fetch(url);

  const pageSource = await res.text();

  // cheerio to parse the page source
  const $ = cheerio.load(pageSource);

  // check all technologies one by one
  const result_checkNextJS = await checkNextJS($);

  if (result_checkNextJS.detected === true) {
    return { name: "next", evidence: result_checkNextJS.evidence };
  }

  return null;
};

export default frameworkDetect;
