import chalk from "chalk";

const frameworkDetect = async (url) => {
  console.log(chalk.cyan("[i] Detecting front-end framework"));

  // get the page source
  const res = await fetch(url);

  const pageSource = await res.text();

  if (pageSource.includes("<script src=\"/_next/static/")) {
    return "next";
  } else {
    return null;
  }
};

export default frameworkDetect;
