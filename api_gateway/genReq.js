import {
  APIGatewayClient,
  CreateResourceCommand,
  GetResourcesCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  CreateDeploymentCommand, // Added CreateDeploymentCommand
  CreateStageCommand,
  PutIntegrationResponseCommand,
  PutMethodResponseCommand,
} from "@aws-sdk/client-api-gateway";
import fs from "fs";
import md5 from "md5";
import chalk from "chalk";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const get = async (configFile, url) => {
  // read the config file
  let config = JSON.parse(fs.readFileSync(configFile));
  // select a random api gateway
  let apiGateway =
    Object.keys(config)[Math.floor(Math.random() * Object.keys(config).length)];

  const client = new APIGatewayClient({
    region: config[apiGateway].region,
    credentials: {
      accessKeyId: config[apiGateway].access_key,
      secretAccessKey: config[apiGateway].secret_key,
    },
  });

  // get the root resource id
  const getResourceCommand = new GetResourcesCommand({
    restApiId: config[apiGateway].id,
  });
  const getResourceResponse = await client.send(getResourceCommand);
  await sleep(200);

  // before creating a resource, check if the resource already exists
  const resourceExists = getResourceResponse.items.find(
    (item) => item.path === md5(url),
  );

  let newResourceResponse;
  if (resourceExists) {
    console.log(chalk.yellow("[!] Resource already exists"));
    newResourceResponse = {
      id: resourceExists.id,
    };
  } else {
    // create a new resource
    const newResourceCommand = new CreateResourceCommand({
      restApiId: config[apiGateway].id,
      parentId: getResourceResponse.items.find((item) => item.path === "/").id,
      pathPart: md5(url), // md5 of the url
    });
    newResourceResponse = await client.send(newResourceCommand);
    await sleep(200);
  }

  // add a new method
  const newMethodCommand = new PutMethodCommand({
    restApiId: config[apiGateway].id,
    resourceId: newResourceResponse.id,
    httpMethod: "GET",
    authorizationType: "NONE",
    requestParameters: {
      "method.request.header.RSC": false,
    },
    integrationHttpMethod: "GET",
    type: "HTTP",
    timeoutInMillis: 29000,
  });
  const newMethodResponse = await client.send(newMethodCommand);
  await sleep(100);

  // create new integration
  const newIntegrationCommand = new PutIntegrationCommand({
    restApiId: config[apiGateway].id,
    resourceId: newResourceResponse.id,
    httpMethod: "GET",
    integrationHttpMethod: "GET",
    type: "HTTP",
    timeoutInMillis: 29000,
    uri: url,
  });
  const newIntegrationResponse = await client.send(newIntegrationCommand);
  await sleep(100);

  // Generate dynamic stage name
  const dynamicStageName = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(chalk.blue(`[*] Using dynamic stage name: ${dynamicStageName}`));

  // Create a deployment
  const createDeploymentCommand = new CreateDeploymentCommand({
    restApiId: config[apiGateway].id,
    stageName: dynamicStageName, // Use dynamic stage name
    description: `Deployment for ${url} at ${new Date().toISOString()} to stage ${dynamicStageName}`
  });
  const deploymentResponse = await client.send(createDeploymentCommand);
  console.log(chalk.green("[+] Deployment created:"), deploymentResponse.id);
  console.log(deploymentResponse);
  await sleep(100);

// create a new method response
const newMethodResponseCommand = new PutMethodResponseCommand({
    httpMethod: "GET",
    resourceId: newResourceResponse.id,
    restApiId: config[apiGateway].id,
    statusCode: "200",
  });
  const newMethodResponseResponse = await client.send(newMethodResponseCommand);
  console.log(newMethodResponseResponse);
  await sleep(100);

// put integration response
const putIntegrationResponseCommand = new PutIntegrationResponseCommand({
    httpMethod: "GET",
    resourceId: newResourceResponse.id,
    restApiId: config[apiGateway].id,
    statusCode: "200",
  });
  const putIntegrationResponseResponse = await client.send(putIntegrationResponseCommand);
  console.log(putIntegrationResponseResponse);
  await sleep(100);


  // create a new stage
//   const newStageCommand = new CreateStageCommand({
//     restApiId: config[apiGateway].id,
//     stageName: dynamicStageName, // Use dynamic stage name
//     deploymentId: deploymentResponse.id, // Use the ID from the deployment
//     cacheClusterEnabled: false,
//     // cacheClusterSize: "0", // Removed as cacheClusterEnabled is false
//     methodSettings: [
//       {
//         httpMethod: "*",
//         // resourceId: "*", // This might need to be more specific if you don't want it for all resources
//         throttlingBurstLimit: 5,
//         throttlingRateLimit: 10,
//       },
//     ],
//   });
//   const newStageResponse = await client.send(newStageCommand);
//   await sleep(100);
//   console.log(newStageResponse);
};

get("../api_gateway_config.json", "https://x.ai");
