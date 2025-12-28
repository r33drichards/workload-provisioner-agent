# AWS Workload Provisioner Agent

An AI-powered assistant that helps you optimize AWS workload provisioning and reduce infrastructure costs.

## Getting Started

First, add your Anthropic API key to `.env.local` file:

```
ANTHROPIC_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start chatting with the agent by describing your workload requirements. The AI will help you find the most cost-effective AWS instance configuration.

## Features

- **Workload Analysis**: Describe your compute, memory, storage, and network needs
- **Cost Optimization**: Uses constraint programming (CSP) to bin-pack workloads across available instance types
- **AWS Instance Recommendations**: Access to AWS instance catalog with pricing information
- **Interactive Clarifications**: The agent asks follow-up questions to better understand your requirements
