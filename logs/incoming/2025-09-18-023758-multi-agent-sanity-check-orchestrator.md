# Multi-agent: Sanity check orchestrator

Received At: 2025-09-18T02:37:58.071Z
Tags: ai, agents

## Input Spec

Sanity check orchestrator

## Provider

rag

## Receptionist

Local agent (no LLM). Prompt received:

You are the Receptionist agent. Restate the user's goal clearly, list 3-5 clarifying questions, and propose a concise success criteria checklist. INPUT SPEC:
Sanity check orchestrator

## Planner

Local agent (no LLM). Prompt received:

You are the Planner agent. Break the project into phases and tasks with owners (frontend/backend/security/networking), inputs/outputs, and acceptance tests. INPUT SPEC:
Sanity check orchestrator

## Frontend

Local agent (no LLM). Prompt received:

You are the Frontend agent. Propose the component/file structure and produce small HTML/CSS/JS samples. Prefer clean, accessible UI, no heavy deps. CONTEXT:
SPEC:
Sanity check orchestrator

RECEPTIONIST:
Local agent (no LLM). Prompt received:

You are the Receptionist agent. Restate the user's goal clearly, list 3-5 clarifying questions, and propose a concise success criteria checklist. INPUT SPEC:
Sanity check orchestrator

PLANNER:
Local agent (no LLM). Prompt received:

You are the Planner agent. Break the project into phases and tasks with owners (frontend/backend/security/networking), inputs/outputs, and acceptance tests. INPUT SPEC:
Sanity check orchestrator

REPO CONTEXT:
LOGS: 6 entries
Sample: Summarize what content is in the repo logs and what tags exist | How to print installed NVIDIA driver version on Linux? | Chat Transcript
RIG:
INPUT SPEC:
Sanity check orchestrator

## Backend

Local agent (no LLM). Prompt received:

You are the Backend agent. Design minimal endpoints, data shapes, and file IO. Target Node.js scripts under site/scripts and static pages consuming JSON under site/public. CONTEXT:
SPEC:
Sanity check orchestrator

RECEPTIONIST:
Local agent (no LLM). Prompt received:

You are the Receptionist agent. Restate the user's goal clearly, list 3-5 clarifying questions, and propose a concise success criteria checklist. INPUT SPEC:
Sanity check orchestrator

PLANNER:
Local agent (no LLM). Prompt received:

You are the Planner agent. Break the project into phases and tasks with owners (frontend/backend/security/networking), inputs/outputs, and acceptance tests. INPUT SPEC:
Sanity check orchestrator

REPO CONTEXT:
LOGS: 6 entries
Sample: Summarize what content is in the repo logs and what tags exist | How to print installed NVIDIA driver version on Linux? | Chat Transcript
RIG:
INPUT SPEC:
Sanity check orchestrator

## Networking

Local agent (no LLM). Prompt received:

You are the Networking agent. Describe any local HTTP endpoints, ports, CORS, and client fetch patterns for the static site. Include curl examples. CONTEXT:
SPEC:
Sanity check orchestrator

RECEPTIONIST:
Local agent (no LLM). Prompt received:

You are the Receptionist agent. Restate the user's goal clearly, list 3-5 clarifying questions, and propose a concise success criteria checklist. INPUT SPEC:
Sanity check orchestrator

PLANNER:
Local agent (no LLM). Prompt received:

You are the Planner agent. Break the project into phases and tasks with owners (frontend/backend/security/networking), inputs/outputs, and acceptance tests. INPUT SPEC:
Sanity check orchestrator

REPO CONTEXT:
LOGS: 6 entries
Sample: Summarize what content is in the repo logs and what tags exist | How to print installed NVIDIA driver version on Linux? | Chat Transcript
RIG:
INPUT SPEC:
Sanity check orchestrator

## Security

Local agent (no LLM). Prompt received:

You are the Security agent. Threat model the plan. Call out unsafe file writes, code exec risks, secrets handling, supply-chain, and client risks. Provide concrete mitigations compatible with this repo (local-first, static site). CONTEXT:
SPEC:
Sanity check orchestrator

RECEPTIONIST:
Local agent (no LLM). Prompt received:

You are the Receptionist agent. Restate the user's goal clearly, list 3-5 clarifying questions, and propose a concise success criteria checklist. INPUT SPEC:
Sanity check orchestrator

PLANNER:
Local agent (no LLM). Prompt received:

You are the Planner agent. Break the project into phases and tasks with owners (frontend/backend/security/networking), inputs/outputs, and acceptance tests. INPUT SPEC:
Sanity check orchestrator

REPO CONTEXT:
LOGS: 6 entries
Sample: Summarize what content is in the repo logs and what tags exist | How to print installed NVIDIA driver version on Linux? | Chat Transcript
RIG:
INPUT SPEC:
Sanity check orchestrator
