import crypto from 'node:crypto';
import { z } from 'zod';
import {
  toolExecutionSchema,
  type ToolDefinition,
  type ToolErrorCode,
  type ToolExecution,
  type ToolExecutionContext,
  type ToolPermission,
} from './core-contracts.js';

type RegisteredTool = ToolDefinition<unknown, unknown>;

export type ToolRunResult = {
  execution: ToolExecution;
  output?: unknown;
};

const ROLE_PERMISSIONS: Record<string, ReadonlySet<ToolPermission>> = {
  owner: new Set(['sales:read', 'quotes:read', 'customers:read', 'approvals:read']),
  manager: new Set(['sales:read', 'quotes:read', 'customers:read', 'approvals:read']),
  operator: new Set(['sales:read', 'quotes:read', 'customers:read', 'approvals:read']),
  channel: new Set(),
};

class ToolRunError extends Error {
  constructor(readonly code: ToolErrorCode, message: string) {
    super(message);
    this.name = 'ToolRunError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new ToolRunError('timeout', 'A ferramenta excedeu o tempo limite.')), timeoutMs);
    promise.then(
      value => { clearTimeout(timeout); resolve(value); },
      error => { clearTimeout(timeout); reject(error); },
    );
  });
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register<TInput, TOutput>(definition: ToolDefinition<TInput, TOutput>): this {
    if (this.tools.has(definition.name)) throw new Error(`Ferramenta duplicada: ${definition.name}`);
    if (definition.timeoutMs < 100 || definition.timeoutMs > 30_000) throw new Error(`Timeout inválido para ${definition.name}`);
    this.tools.set(definition.name, definition as RegisteredTool);
    return this;
  }

  list(): Array<Pick<RegisteredTool, 'name' | 'purpose' | 'requiredPermission' | 'timeoutMs'>> {
    return [...this.tools.values()].map(({ name, purpose, requiredPermission, timeoutMs }) => ({
      name,
      purpose,
      requiredPermission,
      timeoutMs,
    }));
  }

  async execute(name: string, input: unknown, context: ToolExecutionContext): Promise<ToolRunResult> {
    const started = performance.now();
    const startedAt = new Date().toISOString();
    const definition = this.tools.get(name);

    let output: unknown;
    let error: { code: ToolErrorCode; message: string } | undefined;
    let sourceIds: string[] = [];

    try {
      if (!definition) throw new ToolRunError('tool_not_found', 'Ferramenta não encontrada.');
      if (!ROLE_PERMISSIONS[context.tenant.role]?.has(definition.requiredPermission)) {
        throw new ToolRunError('permission_denied', 'O papel atual não possui permissão para esta ferramenta.');
      }

      const parsedInput = definition.inputSchema.safeParse(input);
      if (!parsedInput.success) throw new ToolRunError('invalid_input', parsedInput.error.issues[0]?.message || 'Entrada inválida.');

      const rawOutput = await withTimeout(definition.execute(parsedInput.data, context), definition.timeoutMs);
      const parsedOutput = definition.outputSchema.safeParse(rawOutput);
      if (!parsedOutput.success) throw new ToolRunError('invalid_output', 'A ferramenta retornou dados fora do contrato.');
      output = parsedOutput.data;
      sourceIds = definition.sourceIds(parsedOutput.data);
    } catch (caught) {
      error = caught instanceof ToolRunError
        ? { code: caught.code, message: caught.message }
        : { code: 'execution_failed', message: caught instanceof Error ? caught.message.slice(0, 500) : 'Falha desconhecida.' };
    }

    const completedAt = new Date().toISOString();
    const execution = toolExecutionSchema.parse({
      id: crypto.randomUUID(),
      traceId: context.traceId,
      tenantId: context.tenant.tenantId,
      toolName: name,
      requiredPermission: definition?.requiredPermission,
      status: error ? 'failed' : 'succeeded',
      startedAt,
      completedAt,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      sourceIds,
      error,
    });

    return { execution, ...(error ? {} : { output }) };
  }
}
