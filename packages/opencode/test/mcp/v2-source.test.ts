import { describe, expect } from "bun:test"
import { AgentV2 } from "@opencode-ai/core/agent"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Location } from "@opencode-ai/core/location"
import { Project } from "@opencode-ai/core/project"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionV2 } from "@opencode-ai/core/session"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { ToolSource } from "@opencode-ai/core/tool/source"
import { Effect, Layer } from "effect"
import { MCP, type McpTool } from "../../src/mcp"
import type { InstanceContext } from "../../src/project/instance-context"
import { InstanceStore } from "../../src/project/instance-store"
import { node as McpToolSource } from "../../src/tool/mcp-source"
import { testEffect } from "../lib/effect"

const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = []
const client = {
  callTool: async (input: { name: string; arguments?: Record<string, unknown> }) => {
    calls.push(input)
    return {
      isError: false,
      content: [{ type: "text" as const, text: "memory identity" }],
      structuredContent: { identity: "Melpomene" },
    }
  },
} as unknown as McpTool["client"]

const tool = {
  def: {
    name: "memory_context",
    description: "Load memory context",
    inputSchema: { type: "object", properties: {} },
  },
  client,
} as McpTool

const directory = AbsolutePath.make("/tmp")
const projectID = Project.ID.make("test")
const instance = {
  directory,
  worktree: directory,
  project: { id: projectID, worktree: directory, time: { created: 0, updated: 0 }, sandboxes: [] },
} as InstanceContext

const layer = AppNodeBuilder.build(LayerNode.group([MCP.node, ToolRegistry.node, Location.node, InstanceStore.node]), [
  [MCP.node, Layer.mock(MCP.Service, { tools: () => Effect.succeed({ nephesh_memory_context: tool }) })],
  [ToolSource.node, McpToolSource],
  [Location.node, Layer.succeed(Location.Service, { directory, project: { id: projectID, directory } })],
  [
    InstanceStore.node,
    Layer.mock(InstanceStore.Service, {
      load: () => Effect.succeed(instance),
    }),
  ],
  [
    ToolOutputStore.node,
    Layer.mock(ToolOutputStore.Service, {
      bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
    }),
  ],
])
const it = testEffect(layer)

describe("V2 MCP tool source", () => {
  it.effect("materializes and settles MCP tools through Core", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const materialized = yield* registry.materialize()
      expect(materialized.definitions.map((definition) => definition.name)).toEqual(["nephesh_memory_context"])

      const settled = yield* materialized.settle({
        sessionID: SessionV2.ID.make("ses_mcp_source"),
        agent: AgentV2.ID.make("build"),
        assistantMessageID: SessionMessage.ID.make("msg_mcp_source"),
        call: { type: "tool-call", id: "call-memory", name: "nephesh_memory_context", input: {} },
      })

      expect(calls).toEqual([{ name: "memory_context", arguments: {} }])
      expect(settled.output?.content).toEqual([{ type: "text", text: "memory identity" }])
    }),
  )
})
