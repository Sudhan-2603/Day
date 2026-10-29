// Agents other than Claude Code, as the island shows them. Ids, names and colours
// are PillCatalog.swift's (pill `agent_<id>`), so a pill looks the same on every
// platform.

export interface KnownAgent {
  name: string;
  color: string;
}

export const KNOWN_AGENTS: Record<string, KnownAgent> = {
  claude: { name: "Claude Code", color: "#F5F6F8" },
};

export const APPROVAL_AGENTS = new Set<string>();

/** Same rule as HookServer.validateAgent on macOS. "claude" is reserved. */
export function validateAgent(raw: string | undefined): string | null {
  if (!raw || raw.length > 24 || raw === "claude") return null;
  if (!/^[a-z0-9-]+$/.test(raw)) return null;
  return raw;
}

const FALLBACK_COLORS = ["#22C55E", "#EAB308", "#60A5FA", "#E879F9"];

export function agentColor(id: string): string {
  const known = KNOWN_AGENTS[id];
  if (known) return known.color;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

/** The pill label: the agent's own name when Day knows it, else its id. */
export function agentName(id: string): string {
  return KNOWN_AGENTS[id]?.name ?? id;
}
