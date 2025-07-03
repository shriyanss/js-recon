# API Gateway Command

The `api-gateway` command is used to configure and manage AWS API Gateway for the purpose of IP address rotation. This allows you to make requests from a pool of different IP addresses, which can be useful for avoiding rate limiting.

## Usage

```bash
js-recon api-gateway [options]
```

## Options

| Option                      | Alias | Description                                                           | Default                    | Required |
| --------------------------- | ----- | --------------------------------------------------------------------- | -------------------------- | -------- |
| `--init`                    | `-i`  | Initialize the config file and create a new API Gateway.              | `false`                    | No       |
| `--destroy <id>`            | `-d`  | Destroy the API with the given ID.                                    |                            | No       |
| `--destroy-all`             |       | Destroy all APIs created by this tool in all regions.                 | `false`                    | No       |
| `--region <region>`         | `-r`  | AWS region to create the API in.                                      | random region              | No       |
| `--access-key <access-key>` | `-a`  | AWS access key. Uses `AWS_ACCESS_KEY_ID` env var if not provided.     |                            | No       |
| `--secret-key <secret-key>` | `-s`  | AWS secret key. Uses `AWS_SECRET_ACCESS_KEY` env var if not provided. |                            | No       |
| `--config <config>`         | `-c`  | Name of the config file.                                              | `.api_gateway_config.json` | No       |
| `--list`                    | `-l`  | List all APIs created by this tool.                                   | `false`                    | No       |
| `--feasibility`             |       | Check the feasibility of using API Gateway for a target.              | `false`                    | No       |
| `--feasibility-url <url>`   |       | URL to check the feasibility of.                                      |                            | No       |

## Examples

### Initialize API Gateway

Create a new API Gateway and save its configuration:

```bash
js-recon api-gateway --init
```

### List Created APIs

List all the API Gateways that have been created by this tool:

```bash
js-recon api-gateway --list
```

### Destroy an API

Destroy a specific API Gateway using its ID:

```bash
js-recon api-gateway --destroy <api-id>
```

### Destroy All APIs

Destroy all APIs created by this tool in all regions:

```bash
js-recon api-gateway --destroy-all
```

### Check Feasibility

Check if a target URL is compatible with API Gateway for IP rotation:

```bash
js-recon api-gateway --feasibility --feasibility-url https://example.com
```
