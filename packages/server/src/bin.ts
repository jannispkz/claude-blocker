#!/usr/bin/env node

import { createInterface } from "readline";
import { startServer } from "./server.js";
import { setupHooks, removeHooks, areHooksConfigured } from "./setup.js";
import {
  setupOpenCodePlugin,
  removeOpenCodePlugin,
  isOpenCodePluginConfigured,
} from "./opencode-setup.js";
import { DEFAULT_PORT } from "@claude-blocker/shared";

const args = process.argv.slice(2);

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function printHelp(): void {
  console.log(`
Claude Blocker - Block distracting sites when Claude Code/OpenCode isn't working

Usage:
  npx claude-blocker [options]

Options:
  --setup           Configure both Claude Code and OpenCode hooks
  --remove          Remove both Claude Code and OpenCode hooks
  --setup-claude    Configure Claude Code hooks only
  --setup-opencode  Configure OpenCode plugin only
  --remove-claude   Remove Claude Code hooks only
  --remove-opencode Remove OpenCode plugin only
  --port            Server port (default: ${DEFAULT_PORT})
  --help            Show this help message

Examples:
  npx claude-blocker              # Start server (prompts for setup on first run)
  npx claude-blocker --setup      # Setup hooks for both tools
  npx claude-blocker --port 9000  # Use custom port
`);
}

async function main(): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  // Setup both
  if (args.includes("--setup")) {
    setupHooks();
    setupOpenCodePlugin();
    process.exit(0);
  }

  // Remove both
  if (args.includes("--remove")) {
    removeHooks();
    removeOpenCodePlugin();
    process.exit(0);
  }

  // Individual setup/remove
  if (args.includes("--setup-claude")) {
    setupHooks();
    process.exit(0);
  }

  if (args.includes("--setup-opencode")) {
    setupOpenCodePlugin();
    process.exit(0);
  }

  if (args.includes("--remove-claude")) {
    removeHooks();
    process.exit(0);
  }

  if (args.includes("--remove-opencode")) {
    removeOpenCodePlugin();
    process.exit(0);
  }

  // Parse port
  let port = DEFAULT_PORT;
  const portIndex = args.indexOf("--port");
  if (portIndex !== -1 && args[portIndex + 1]) {
    const parsed = parseInt(args[portIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      port = parsed;
    } else {
      console.error("Invalid port number");
      process.exit(1);
    }
  }

  // Check if any hooks are configured, prompt for setup if not
  const claudeConfigured = areHooksConfigured();
  const openCodeConfigured = isOpenCodePluginConfigured();

  if (!claudeConfigured && !openCodeConfigured) {
    console.log("Claude Blocker hooks are not configured yet.\n");
    const answer = await prompt("Would you like to set them up now? (Y/n) ");
    const normalized = answer.trim().toLowerCase();

    if (normalized === "" || normalized === "y" || normalized === "yes") {
      setupHooks();
      setupOpenCodePlugin();
      console.log(""); // Add spacing before server start
    } else {
      console.log("\nSkipping setup. You can run 'npx claude-blocker --setup' later.\n");
    }
  }

  startServer(port);
}

main();
