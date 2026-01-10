"use client";

import { useState, useSyncExternalStore, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Server } from "lucide-react";
import { toast } from "sonner";
import {
  addMcpServer,
  removeMcpServer,
  toggleMcpServer,
  type McpServerConfig,
} from "@/lib/mcp-config";

const MCP_SERVERS_KEY = "habu-mcp-servers";

// Custom store for MCP servers with subscribe capability
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): McpServerConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(MCP_SERVERS_KEY);
    return stored ? (JSON.parse(stored) as McpServerConfig[]) : [];
  } catch {
    return [];
  }
}

function getServerSnapshot(): McpServerConfig[] {
  return [];
}

export function McpServersSettings() {
  const servers = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = useCallback(() => {
    if (!newUrl.trim()) {
      toast.error("URL is required");
      return;
    }

    try {
      new URL(newUrl);
    } catch {
      toast.error("Invalid URL format");
      return;
    }

    try {
      addMcpServer(newUrl, newName || undefined);
      emitChange();
      setNewUrl("");
      setNewName("");
      setIsAdding(false);
      toast.success("MCP server added");
    } catch (error) {
      toast.error("Failed to add server", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [newUrl, newName]);

  const handleRemove = useCallback((id: string) => {
    removeMcpServer(id);
    emitChange();
    toast.success("MCP server removed");
  }, []);

  const handleToggle = useCallback((id: string) => {
    toggleMcpServer(id);
    emitChange();
  }, []);

  return (
    <div className="space-y-4">
      {servers.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground">
          No MCP servers configured. Add one to enable additional tools in chat.
        </p>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div key={server.id} className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <Server className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{server.name}</div>
                <div className="text-xs text-muted-foreground truncate">{server.url}</div>
              </div>
              <Switch
                checked={server.enabled}
                onCheckedChange={() => handleToggle(server.id)}
                aria-label={`Toggle ${server.name}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(server.id)}
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="space-y-3 p-3 border rounded-md">
          <div className="space-y-2">
            <Label htmlFor="mcp-url" className="text-sm">
              Server URL
            </Label>
            <Input
              id="mcp-url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://mcp.example.com"
              type="url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-name" className="text-sm">
              Name (optional)
            </Label>
            <Input
              id="mcp-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My MCP Server"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} size="sm">
              Add
            </Button>
            <Button
              onClick={() => {
                setIsAdding(false);
                setNewUrl("");
                setNewName("");
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setIsAdding(true)} variant="outline" size="sm" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add MCP Server
        </Button>
      )}
    </div>
  );
}
