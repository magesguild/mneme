import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { Effect, Layer, Schema } from "effect"
import { ToolSource } from "@opencode-ai/core/tool/source"
import { Tool } from "@opencode-ai/core/tool/tool"
import { makeLocationNode } from "@opencode-ai/core/effect/app-node"
import { Location } from "@opencode-ai/core/location"
import { MCP, type McpTool } from "@/mcp"
import { InstanceRef } from "@/effect/instance-ref"
import { InstanceStore } from "@/project/instance-store"

const content = (value: unknown): ReadonlyArray<Tool.Content> => {
  if (!isRecord(value) || !Array.isArray(value.content)) return []
  return value.content.flatMap((item): ReadonlyArray<Tool.Content> => {
    if (!isRecord(item) || typeof item.type !== "string") return []
    if (item.type === "text" && typeof item.text === "string") return [{ type: "text", text: item.text }]
    if ((item.type === "image" || item.type === "audio") && typeof item.data === "string") {
      return typeof item.mimeType === "string"
        ? [{ type: "file", data: item.data, mime: item.mimeType }]
        : [{ type: "text", text: JSON.stringify(item) }]
    }
    return [{ type: "text", text: JSON.stringify(item) }]
  })
}

const message = (value: unknown) => {
  if (typeof value === "string") return value
  if (isRecord(value) && Array.isArray(value.content)) {
    const text = value.content
      .flatMap((item) => (isRecord(item) && item.type === "text" && typeof item.text === "string" ? [item.text] : []))
      .filter((item) => item.trim())
      .join("\n\n")
    if (text) return text
  }
  return "MCP tool returned an error"
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const makeTool = (item: McpTool) =>
  Tool.make({
    description: item.def.description ?? "",
    input: Schema.Unknown,
    output: Schema.Unknown,
    inputSchema: {
      ...(item.def.inputSchema as Record<string, unknown>),
      type: "object",
      additionalProperties: false,
    },
    execute: (input) =>
      Effect.tryPromise({
        try: () =>
          item.client.callTool(
            {
              name: item.def.name,
              arguments: (input || {}) as Record<string, unknown>,
            },
            CallToolResultSchema,
            {
              timeout: item.timeout,
              resetTimeoutOnProgress: true,
              onprogress: () => {},
            },
          ),
        catch: (error) => new Tool.Failure({ message: error instanceof Error ? error.message : String(error) }),
      }).pipe(
        Effect.flatMap((result) =>
          result.isError ? Effect.fail(new Tool.Failure({ message: message(result) })) : Effect.succeed(result),
        ),
      ),
    toModelOutput: ({ output }) => content(output),
  })

export const node = makeLocationNode({
  service: ToolSource.Service,
  layer: Layer.effect(
    ToolSource.Service,
    Effect.gen(function* () {
      const mcp = yield* MCP.Service
      const instances = yield* InstanceStore.Service
      const location = yield* Location.Service
      return ToolSource.Service.of({
        tools: Effect.fn("McpToolSource.tools")(function* () {
          const instance = yield* instances.load({ directory: location.directory })
          const tools = yield* mcp.tools().pipe(Effect.provideService(InstanceRef, instance))
          return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, makeTool(tool)]))
        }),
      })
    }),
  ),
  deps: [MCP.node, InstanceStore.node, Location.node],
})
