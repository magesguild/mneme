export * as ToolSource from "./source"

import { Context, Effect, Layer } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { Tool } from "./tool"

export interface Interface {
  readonly tools: () => Effect.Effect<Readonly<Record<string, Tool.AnyTool>>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/ToolSource") {}

export const node = makeLocationNode({
  service: Service,
  layer: Layer.succeed(Service, {
    tools: () => Effect.succeed({}),
  }),
  deps: [],
})
