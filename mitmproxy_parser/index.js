import express from "express";
import chalk from "chalk";
import * as globals from "../utility/globals.js";
import * as queue from "./queue.js";

const baseUrl = `http://localhost:${globals.getMitmParseServerPort()}`;
const queueUrl = `${baseUrl}/queue`;
const htmlContent = `
<!doctype html>
<html>
  <head>
    <title>JS Recon</title>
  </head>
  <body>
    <h1>JS Recon - MITM Proxy Parser</h1>
    <p>You must keep this page open while running the mitmproxy module.</p>
    <p>Please allow this page to open popups when requested</p>

    <script>
        const url = "${queueUrl}";

        // onload, try to open random site
        window.onload = () => {
            window.open("https://example.com", "_blank");
        };

        // sleep for 5s
        function sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }

        // continuously get the requests from the queue
        setInterval(async () => {
            // make a request to the server to get the next request
            const resp = await fetch(url);
            const nextUrl = await resp.text();
            if (nextUrl !== "empty") {
                window.open(nextUrl, "_blank");
            }
        }, 50);
    </script>
  </body>
</html>
`;

const mitmproxy_parser = async () => {
  const mitmproxy_parser_server = express();

  mitmproxy_parser_server.use(express.json());

  // the homepage to open the links requested
  mitmproxy_parser_server.get("/", (req, res) => {
    res.send(htmlContent);
  });

  // the api request to send the info for HTTP request
  mitmproxy_parser_server.post("/mitmparse", (req, res) => {
    console.log(
      chalk.cyan(`[i] Received request from mitmdump: ${req.body.url}`),
    );
    res.send("ok");
  });

  mitmproxy_parser_server.get("/queue", (req, res) => {
    const url = queue.getRequest();
    if (url) {
      res.send(url);
    } else {
      res.send("empty");
    }
  });

  const server = mitmproxy_parser_server.listen(
    globals.getMitmParseServerPort(),
    () => {
      console.log(
        chalk.cyan(
          `[i] MITM parse server running on port ${globals.getMitmParseServerPort()}`,
        ),
      );
      console.log(
        chalk.bgGreen(
          `Open ${baseUrl} in browser with proxy to mitmproxy port, and certificate authority added.`,
        ),
      );
    },
  );

  return server;
};

export default mitmproxy_parser;
