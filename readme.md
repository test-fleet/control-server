# Welcome to the TestFleet GitHub!

**Helm charts & deployment guide [here](https://github.com/test-fleet/helm-charts)**

## What is TestFleet?

TestFleet is an open source API testing & monitoring tool. It runs scheduled, multi-step HTTP checks against your APIs. Users have the option to generate assertions on each request to validate responses against expected values. TestFleet also has the ability to extract variables from responses, allowing them to be referenced in future steps of the test. 

## Scenes & Frames
API tests are referred to as **scenes**, and each step within a scene, is a **frame**. 

The **scene** can be thought of as a HTTP test container, with some additional fields that allow the control server to schedule their execution. When creating a new scene, you can select a frequency, which denotes the interval at which it will be run. This ranges from 1 minute, to 24 hours. For time sensitive test cases, you can configure a timeout threshold, which will fail the test automatically if exceeded. And finally, you can configure the 'pass threshold', which tells the results aggregator how many test 'runners' must pass the test for it to be considered a passing scene.  

**Frames** are what allow you to generate detailed HTTP tests. These are the 'steps' in your multi-step API tests. This is where you configure the HTTP request itself, with a test window to quickly run your request as you generate it. 

## Assertions & Extractions
The most important part of HTTP testing is validating results from your requests. TestFleet has a comprehensive assertion engine, that allows you to assert on JSON contents, status codes, and header values. Failed assertions at any point will fail the entire scene, and immediately return the results.

Another core feature of multi-step API testing, is being able to use values from previous requests. This is where frame extractors come in. Extractors let you store JSON and header values from a frame's response into a scene-scoped variable, which can then be referenced in any subsequent frame.

## How does it work?
TestFleet at its core has two components. The Control Server, and the Test Runner.

**Control Server:** 
This is the 'brain' of the system. Designed as a single deployment hub, the control server handles SSO, runner registration, scene & frame management, job scheduling, database & Redis connectivity, & serving the frontend for users to interface with the API.

**Test Runner:**
Think of these as the workers. Runners are headless execution engines, meant to be deployed anywhere, to create the coverage your testing requires. TestFleet schedules tests by broadcasting to **all** runners using Redis pub/sub. Once a runner receives a job, it's handed off to a pool of goroutines (workers) that pull jobs from a shared queue, letting the runner process multiple scenes concurrently. When a scene is executed, the runner then sends the results back to the control server via HTTP.

## Authentication & SSO
TestFleet uses SSO for all user logins to the control server. Users authenticate through your organization's identity provider, and TestFleet issues a JWT once that login succeeds.

**Supported Providers:** Google, Github, Microsoft, & Okta. Only **one** SSO provider can be active per deployment.

An **admin** account must be bootstrapped on the first deployment of the control server by providing the SSO linked email for the admin account. This will 'invite' the bootstrapped user with admin account privileges.

**Invite only**. To create additional accounts, the bootstrapped admin account can invite users by email. Once a user has been invited, they can simply log into the control server via SSO. Additional users can be invited with either 'admin' or 'user' roles.

## Security 


Runners don't authenticate the same way users do. Instead of logging in, they sign each request with a secret key.

Requests are signed with **HMAC**.  Each runner has a secret key, and every request is signed using HMAC-SHA256. The server recomputes the signature on its end and compares it to what the runner sent. If they don't match, the request is rejected.

Credentials are encrypted at rest, a runner's secret is never stored in plain text. Each request includes a timestamp, and anything outside a tight window is rejected, so a leaked signature can't be reused later. Disabling a runner blocks it on its very next request.

## Repos

TestFleet is split across a few repositories, since the control server and the runners are deployed independently.

**[test-fleet/control-server](https://github.com/test-fleet/control-server)**  — Contains the control server and frontend.

**[test-fleet/test-runner](https://github.com/test-fleet/test-runner)**  — the stateless execution engine that runs your scenes. Deploy as many as you need, wherever you need coverage from.

**[test-fleet/helm-charts](https://github.com/test-fleet/helm-charts)**  — Helm charts for deploying both the control server and test runners on Kubernetes.

## For local development:

### Set .env vars
Copy the example environment file and populate with your values:
```bash
cp .env.example .env
# Populate .env with your actual values
```

### Start the development environment
Use the Makefile to start all services:
```bash
make dev
```

This will:
- Start MongoDB with persistent storage
- Build and start the control server container

### Verify everything is working
Check service status:
```bash
make status
```

Test database connection:
```bash
make test-db
```

### View logs
```bash
make logs
```

### Stop services
```bash
make stop
```

### Access the application
- **Control Server**: http://localhost:3000
- **MongoDB**: localhost:27017

### Other useful commands
```bash
make build    # Rebuild and start services
make status   # Check service status
make clean    # Stop and remove all data (destructive!)
```
### Test Runner
The distributed runner that executes scenes is maintained in a separate repository: [test-fleet/test-runner](https://github.com/test-fleet/test-runner).
