const githubURL = "https://github.com/shriyanss/js-recon";
const modulesDocs = "https://js-recon.io/docs/category/modules";
const version = "1.1.4-alpha.4";
const toolDesc = "JS Recon Tool";
const axiosNonHttpMethods = ["isAxiosError"]; // methods available in axios, which are not for making HTTP requests

let CONFIG = {
    github: githubURL,
    modulesDocs: modulesDocs,
    notFoundMessage: `If you believe this is an error or is a new technology, please create an issue on ${githubURL} and we'll figure it out for you`,
    version: version,
    toolDesc: toolDesc,
    axiosNonHttpMethods: axiosNonHttpMethods,
};

export default CONFIG;
