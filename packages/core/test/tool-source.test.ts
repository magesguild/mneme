import { describe, expect } from "bun:test"
import { AgentV2 } from "@opencode-ai/core/agent"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionV2 } from "@opencode-ai/core/session"
import { Tool } from "@opencode-ai/core/tool/tool"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { ToolSource } from "@opencode-ai/core/tool/source"
import { Effect, Layer, Schema } from "effect"
import { testEffect } from "./lib/effect"

const sourceTool = Tool.make({
  description: "A source-provided tool",
  input: Schema.Struct({ text: Schema.String }),
  output: Schema.Struct({ text: Schema.String }),
  execute: ({ text }) => Effect.succeed({ text }),
  toModelOutput: ({ output }) => [{ type: "text", text: output.text }],
})

const outputStore = Layer.mock(ToolOutputStore.Service, {
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
})

const source = Layer.succeed(ToolSource.Service, {
  tools: () => Effect.succeed({ external: sourceTool }),
})

const it = testEffect(
  AppNodeBuilder.build(ToolRegistry.node, [
    [ToolOutputStore.node, outputStore],
    [ToolSource.node, source],
  ]),
)

const sessionID = SessionV2.ID.make("ses_tool_source")
const assistantMessageID = SessionMessage.ID.make("msg_tool_source")

describe("ToolSource", () => {
  it.effect("materializes and settles source-provided tools through the registry", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const materialized = yield* registry.materialize()
      expect(materialized.definitions.map((definition) => definition.name)).toEqual(["external"])

      const settled = yield* materialized.settle({
        sessionID,
        agent: AgentV2.ID.make("build"),
        assistantMessageID,
        call: { type: "tool-call", id: "call-source", name: "external", input: { text: "hello" } },
      })

      expect(settled.output?.content).toEqual([{ type: "text", text: "hello" }])
    }),
  )
})
