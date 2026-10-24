# Deployment and validation status

## Local delivery

Python 3.13 and Node 22 are the intended runtimes. `requirements.lock.txt` pins the resolved server/test environment; the Windows-only `pywin32` dependency has a platform marker. `frontend/package-lock.json` pins the frontend. CI is the cross-platform check rather than an assumption that the Windows environment proves Linux compatibility.

The multi-stage Dockerfile builds TypeScript/React, installs Python dependencies, trains the model, and runs as a non-root user. Compose binds port 8000 to `127.0.0.1` and retains SQL state in a Docker volume. The model and training data remain in the image; runtime data is stored under a separate `artifacts/state` directory. Optional Prometheus scraping is configured in `infra/prometheus.yml`.

```bash
docker compose up --build
docker compose --profile monitoring up --build
```

Use one command or the other. Stop with `docker compose down`; the named volume remains. A local Docker CLI was present but its daemon was not running, so the local Docker image was not claimed as tested. The GitHub workflow builds the image after tests and publishes it on a successful push to main. Check the actual run before claiming that Docker build passed.

## CI/CD

The quality job trains, runs pytest, evaluates retrieval, compiles the frontend, uploads report artifacts and builds the container. The main-branch publish job logs into GHCR using the repository's scoped workflow token and publishes `ghcr.io/pavan-amikula/forgesignal:latest`. No deployment or cloud credentials are stored in the repository. Pin a published digest before a controlled deployment. A new GHCR package may need its visibility changed to public in package settings for anonymous pulls.

## Azure evaluation template

`infra/main.bicep` defines a single Azure Container Apps environment and one application replica, HTTPS ingress, an explicit allowed reviewer CIDR, a secret-backed write token and a liveness probe. It is an evaluation template, not a claimed deployed environment. No cloud resource was created and no Azure charges were incurred by the local project setup.

After installing Azure CLI/Bicep and choosing a subscription, a reviewer can validate and deploy with their own values:

```bash
az bicep build --file infra/main.bicep
az group create --name forge-evaluation --location westeurope
az deployment group create --resource-group forge-evaluation \
  --template-file infra/main.bicep \
  --parameters image=PUBLIC_IMAGE_DIGEST allowedCidr=YOUR_PUBLIC_IP/32 writeToken=YOUR_LONG_RANDOM_SECRET
```

Provide secrets through an approved secure parameter file or secret injection in practice; do not commit them or retain them in shell history. The image must be publicly pullable, or registry credentials/managed identity must be added. The template deliberately uses extractive mode and does not configure an LLM key.

**Persistence limit:** Container Apps local storage is ephemeral; this evaluation template loses SQL state on replacement and must not hold important decisions. Do not mount SQLite WAL on an Azure Files share as a shortcut. Replace SQLite with a managed PostgreSQL implementation before a persistent/shared cloud pilot. The local Compose volume provides the runnable persistence demonstration.

Azure configuration references: [IP restrictions](https://learn.microsoft.com/en-us/azure/container-apps/ip-restrictions), [storage lifetimes](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts). Cloud rollout additionally needs identity/RBAC, rate limiting, secret management, monitoring retention and restore drills. Horizontal scaling requires moving replay scheduling and event storage out of process.
