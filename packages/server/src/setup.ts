import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { DEFAULT_PORT } from "@claude-blocker/shared";

interface ClaudeSettings {
  hooks?: Record<string, unknown[]>;
  [key: string]: unknown;
}

const HOOK_COMMAND = `curl -s -X POST http://localhost:${DEFAULT_PORT}/hook -H 'Content-Type: application/json' -d "$(cat)" > /dev/null 2>&1 &`;

const HOOKS_CONFIG = {
  UserPromptSubmit: [
    {
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND,
        },
      ],
    },
  ],
  PreToolUse: [
    {
      matcher: "*",
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND,
        },
      ],
    },
  ],
  Stop: [
    {
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND,
        },
      ],
    },
  ],
  SessionStart: [
    {
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND,
        },
      ],
    },
  ],
  SessionEnd: [
    {
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND,
        },
      ],
    },
  ],
  Notification: [
    {
      matcher: "permission_prompt",
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND,
        },
      ],
    },
  ],
};

// Check if our hook command already exists in a hooks array
function hasOurHook(hooks: unknown[]): boolean {
  return hooks.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (!Array.isArray(e.hooks)) return false;
    return e.hooks.some((h: unknown) => {
      if (typeof h !== "object" || h === null) return false;
      const hook = h as Record<string, unknown>;
      return typeof hook.command === "string" && hook.command.includes("localhost:8765/hook");
    });
  });
}

export function setupHooks(): void {
  const claudeDir = join(homedir(), ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  // Ensure .claude directory exists
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
    console.log(`Created ${claudeDir}`);
  }

  // Load existing settings or create empty object
  let settings: ClaudeSettings = {};
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, "utf-8");
      settings = JSON.parse(content);
      console.log("Loaded existing settings.json");
    } catch (error) {
      console.error("Error reading settings.json:", error);
      console.log("Creating new settings.json");
    }
  }

  // Initialize hooks if not present
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Merge hooks - append our hooks to existing ones instead of replacing
  for (const [hookName, ourEntries] of Object.entries(HOOKS_CONFIG)) {
    const existing = settings.hooks[hookName];
    if (!existing || !Array.isArray(existing)) {
      // No existing hooks for this event, add ours
      settings.hooks[hookName] = ourEntries;
    } else if (!hasOurHook(existing)) {
      // Existing hooks but ours isn't there, append our entries
      settings.hooks[hookName] = [...existing, ...ourEntries];
    }
    // If our hook already exists, don't duplicate
  }

  // Write settings
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  console.log(`
┌─────────────────────────────────────────────────┐
│                                                 │
│   Claude Blocker Setup Complete!                │
│                                                 │
│   Hooks configured in:                          │
│   ${settingsPath}
│                                                 │
│   Configured hooks:                             │
│   - UserPromptSubmit (work starting)            │
│   - PreToolUse (tool executing)                 │
│   - Stop (work finished)                        │
│   - SessionStart (session began)                │
│   - SessionEnd (session ended)                  │
│   - Notification (permission prompts)           │
│                                                 │
│   Next: Run 'npx claude-blocker' to start       │
│                                                 │
└─────────────────────────────────────────────────┘
`);
}

export function areHooksConfigured(): boolean {
  const settingsPath = join(homedir(), ".claude", "settings.json");

  if (!existsSync(settingsPath)) {
    return false;
  }

  try {
    const content = readFileSync(settingsPath, "utf-8");
    const settings: ClaudeSettings = JSON.parse(content);

    if (!settings.hooks) {
      return false;
    }

    // Check if at least one of our hooks is configured
    return Object.keys(HOOKS_CONFIG).some((hookName) => hookName in settings.hooks!);
  } catch {
    return false;
  }
}

// Remove our hook entries from a hooks array, preserving user's custom hooks
function removeOurHookEntries(hooks: unknown[]): unknown[] {
  return hooks.filter((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return true;
    const e = entry as Record<string, unknown>;
    if (!Array.isArray(e.hooks)) return true;
    // Check if this entry ONLY has our hook (no user commands)
    const hasOnlyOurHook = e.hooks.every((h: unknown) => {
      if (typeof h !== "object" || h === null) return false;
      const hook = h as Record<string, unknown>;
      return typeof hook.command === "string" && hook.command.includes("localhost:8765/hook");
    });
    // Remove entry if it only contains our hook
    return !hasOnlyOurHook;
  });
}

export function removeHooks(): void {
  const settingsPath = join(homedir(), ".claude", "settings.json");

  if (!existsSync(settingsPath)) {
    console.log("No settings.json found, nothing to remove.");
    return;
  }

  try {
    const content = readFileSync(settingsPath, "utf-8");
    const settings: ClaudeSettings = JSON.parse(content);

    if (settings.hooks) {
      // Remove only our hook entries, preserve user's custom hooks
      for (const hookName of Object.keys(HOOKS_CONFIG)) {
        if (settings.hooks[hookName] && Array.isArray(settings.hooks[hookName])) {
          const filtered = removeOurHookEntries(settings.hooks[hookName] as unknown[]);
          if (filtered.length === 0) {
            delete settings.hooks[hookName];
          } else {
            settings.hooks[hookName] = filtered;
          }
        }
      }

      // If hooks object is empty, remove it entirely
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log("Claude Blocker hooks removed from settings.json");
    } else {
      console.log("No hooks found in settings.json");
    }
  } catch (error) {
    console.error("Error removing hooks:", error);
  }
}
