import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Handler = (event: unknown, ctx: unknown) => unknown;

export type FakeSessionEntry = {
  type: string;
  id: string;
  message?: { role?: string; content?: unknown };
};

export type FakePiOptions = {
  cwd: string;
  prompt?: string;
  sessionId?: string;
  sessionFile?: string;
  leafId?: string;
  branch?: FakeSessionEntry[];
};

export function createFakePi(opts: FakePiOptions) {
  const handlers = new Map<string, Handler[]>();
  const tools = new Map<
    string,
    {
      name: string;
      execute: (
        toolCallId: string,
        params: Record<string, unknown>,
        signal: AbortSignal | undefined,
        onUpdate: undefined,
        ctx: { cwd: string },
      ) => Promise<{ content: unknown; details?: unknown }>;
    }
  >();
  const commands = new Map<
    string,
    {
      handler: (
        args: string,
        ctx: { ui: { notify: (message: string, level?: string) => void } },
      ) => Promise<void> | void;
      getArgumentCompletions?: (prefix: string) => unknown;
    }
  >();
  const userMessages: Array<{ content: unknown; options?: unknown }> = [];
  const notifications: Array<{ message: string; level?: string }> = [];

  const prompt = opts.prompt ?? "keep retries at 3";
  const sessionManager = {
    getSessionId: () => opts.sessionId ?? "session-1",
    getSessionFile: () => opts.sessionFile ?? "/tmp/fake-session.jsonl",
    getLeafId: () => opts.leafId ?? "leaf-1",
    getBranch: () =>
      opts.branch ?? [
        {
          type: "message",
          id: "um-1",
          message: {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        },
      ],
  };

  const ui = {
    notify(message: string, level?: string) {
      notifications.push({ message, level });
    },
  };

  const ctx = {
    cwd: opts.cwd,
    sessionManager,
    model: { provider: "test", id: "model" },
    ui,
  };

  const api = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    registerTool(def: { name: string; execute: (typeof tools extends Map<string, infer V> ? V : never)["execute"] }) {
      tools.set(def.name, def);
    },
    registerCommand(
      name: string,
      options: {
        handler: (
          args: string,
          ctx: { ui: { notify: (message: string, level?: string) => void } },
        ) => Promise<void> | void;
        getArgumentCompletions?: (prefix: string) => unknown;
      },
    ) {
      commands.set(name, options);
    },
    sendUserMessage(content: unknown, options?: unknown) {
      userMessages.push({ content, options });
    },
  } as unknown as ExtensionAPI;

  async function emit(event: string, payload: Record<string, unknown> = {}) {
    const list = handlers.get(event) ?? [];
    let last: unknown;
    for (const handler of list) {
      last = await handler({ type: event, ...payload }, ctx);
    }
    return last;
  }

  function commandCtx() {
    return {
      cwd: opts.cwd,
      ui,
    };
  }

  return {
    api,
    tools,
    commands,
    userMessages,
    notifications,
    emit,
    ctx,
    sessionManager,
    commandCtx,
  };
}
