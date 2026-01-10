/**
 * MCP Server configuration utilities
 * Stores and manages user-configured MCP server URLs in localStorage
 */

const MCP_SERVERS_KEY = "habu-mcp-servers";

export interface McpServerConfig {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
  addedAt: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function getMcpServers(): McpServerConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(MCP_SERVERS_KEY);
    return stored ? (JSON.parse(stored) as McpServerConfig[]) : [];
  } catch {
    return [];
  }
}

export function getEnabledMcpServers(): McpServerConfig[] {
  return getMcpServers().filter((s) => s.enabled);
}

export function addMcpServer(url: string, name?: string): McpServerConfig {
  const servers = getMcpServers();
  const newServer: McpServerConfig = {
    id: generateId(),
    url: url.trim(),
    name: name?.trim() || new URL(url).hostname,
    enabled: true,
    addedAt: Date.now(),
  };
  servers.push(newServer);
  localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers));
  return newServer;
}

export function removeMcpServer(id: string): void {
  const servers = getMcpServers().filter((s) => s.id !== id);
  localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers));
}

export function toggleMcpServer(id: string): void {
  const servers = getMcpServers().map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
  localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers));
}

export function updateMcpServer(
  id: string,
  updates: Partial<Pick<McpServerConfig, "url" | "name">>,
): void {
  const servers = getMcpServers().map((s) => (s.id === id ? { ...s, ...updates } : s));
  localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers));
}
