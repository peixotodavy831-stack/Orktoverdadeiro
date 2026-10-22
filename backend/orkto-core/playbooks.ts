import crypto from 'node:crypto';

// ORKTO Playbooks R1 — primeiro incremento do ORKTO_PLAYBOOKS_2027_ARCHITECTURE.md:
// validador e prévia SEM efeitos. Este módulo nunca escreve, agenda, envia ou
// cobra. Execução real de recuperação continua exclusivamente nos caminhos já
// aprovados (cadência + aprovação WIA + tarefa interna) e não é iniciada aqui.

export type PlaybookStepKind = 'context_read' | 'condition' | 'approval' | 'internal_task' | 'finalize';
export type PlaybookTriggerFamily = 'manual' | 'record' | 'schedule';
export type PlaybookResolutionState = 'succeeded' | 'assumed_by_human' | 'escalated';

export interface PlaybookApprovalField {
  id: string;
  kind: 'boolean' | 'text';
  required: boolean;
}

export interface PlaybookStep {
  id: string;
  kind: PlaybookStepKind;
  title: string;
  description: string;
  requires_approval?: boolean;
  sources?: string[];
  approval_design?: {
    question: string;
    response_fields: PlaybookApprovalField[];
    timeout_policy: string;
  };
  authorized_task?: {
    title: string;
    idempotency_basis: string;
  };
}

export interface PlaybookDefinition {
  key: string;
  version: string;
  title: string;
  when_to_use: string;
  not_when: string[];
  trigger: { family: PlaybookTriggerFamily; label: string };
  entry_signal: { source: 'radar'; kind: 'unanswered_proposal' | 'unattended_lead' | 'overdue_followup' };
  steps: PlaybookStep[];
  external_effects: string[];
  blocked_effects: string[];
  resolution_states: PlaybookResolutionState[];
}

export type PlaybookGateState = 'active' | 'inactive' | 'off_by_default' | 'unknown';

export interface PlaybookPreviewStep {
  id: string;
  kind: PlaybookStepKind;
  title: string;
  description: string;
  requires_approval: boolean;
  preview_note: string;
}

export interface PlaybookPreview {
  playbook_key: string;
  version: string;
  digest: string;
  title: string;
  when_to_use: string;
  not_when: string[];
  trigger: PlaybookDefinition['trigger'];
  entry_signal: PlaybookDefinition['entry_signal'];
  steps: PlaybookPreviewStep[];
  approval_points: Array<{
    step_id: string;
    question: string;
    response_fields: PlaybookApprovalField[];
    timeout_policy: string;
  }>;
  effects: {
    internal: string[];
    external: string[];
    blocked: string[];
  };
  execution_status: 'not_available_in_r1';
  resolution_states: PlaybookResolutionState[];
  gate: { feature_key: string; state: PlaybookGateState };
}

export type ValidateResult =
  | { ok: true; definition: PlaybookDefinition }
  | { ok: false; errors: string[] };

const STEP_KINDS: PlaybookStepKind[] = ['context_read', 'condition', 'approval', 'internal_task', 'finalize'];
const TRIGGER_FAMILIES: PlaybookTriggerFamily[] = ['manual', 'record', 'schedule'];
const RESOLUTION_STATES: PlaybookResolutionState[] = ['succeeded', 'assumed_by_human', 'escalated'];
const MAX_STEPS = 12;

const LIMITS = {
  key: { min: 3, max: 64 },
  version: 16,
  title: { min: 5, max: 120 },
  text: { min: 5, max: 500 },
  item: { min: 1, max: 300 },
} as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function keyPattern(key: string): boolean {
  return /^[a-z][a-z0-9_]{2,63}$/.test(key);
}

function boundedLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

export function validatePlaybookDefinition(input: unknown): ValidateResult {
  const errors: string[] = [];
  if (!isPlainObject(input)) return { ok: false, errors: ['definição precisa ser um objeto'] };
  const raw = input;
  for (const field of ['key', 'version', 'title', 'when_to_use', 'not_when', 'trigger', 'entry_signal', 'steps', 'external_effects', 'blocked_effects', 'resolution_states']) {
    if (!(field in raw)) errors.push(`campo obrigatório ausente: ${field}`);
  }
  if (errors.length) return { ok: false, errors };

  if (!isNonEmptyString(raw.key) || !keyPattern(raw.key)) errors.push('key inválida (minúsculas, números e _, iniciando por letra)');
  if (!isNonEmptyString(raw.version) || !boundedLength(raw.version, 1, LIMITS.version)) errors.push('version inválida');

  if (!isNonEmptyString(raw.title) || !boundedLength(raw.title, LIMITS.title.min, LIMITS.title.max)) errors.push('title inválida');
  if (!isNonEmptyString(raw.when_to_use) || !boundedLength(raw.when_to_use, LIMITS.text.min, LIMITS.text.max)) errors.push('when_to_use inválida');
  if (!Array.isArray(raw.not_when) || raw.not_when.length > 8 || !raw.not_when.every(item => isNonEmptyString(item) && boundedLength(item, LIMITS.item.min, LIMITS.item.max))) errors.push('not_when inválida (até 8 itens)');

  const trigger = raw.trigger;
  if (!isPlainObject(trigger) || !TRIGGER_FAMILIES.includes(trigger.family as PlaybookTriggerFamily) || !isNonEmptyString(trigger.label) || !boundedLength(trigger.label, LIMITS.item.min, LIMITS.item.max)) {
    errors.push('trigger inválido (família manual|record|schedule e rótulo)');
  }

  const entrySignal = raw.entry_signal;
  const radarKinds = ['unanswered_proposal', 'unattended_lead', 'overdue_followup'];
  if (!isPlainObject(entrySignal) || entrySignal.source !== 'radar' || !radarKinds.includes(String(entrySignal.kind))) {
    errors.push('entry_signal inválido (somente origem radar na R1)');
  }

  if (!Array.isArray(raw.external_effects) || raw.external_effects.length !== 0) {
    errors.push('external_effects deve ser vazio na R1 (prévia sem efeitos)');
  }
  if (!Array.isArray(raw.blocked_effects) || raw.blocked_effects.length === 0 || raw.blocked_effects.length > 8 || !raw.blocked_effects.every(item => isNonEmptyString(item) && boundedLength(item, LIMITS.item.min, LIMITS.item.max))) {
    errors.push('blocked_effects deve listar 1..8 efeitos bloqueados');
  }

  const resolutionStates = raw.resolution_states;
  if (!Array.isArray(resolutionStates) || resolutionStates.length === 0 || !resolutionStates.every(state => RESOLUTION_STATES.includes(state as PlaybookResolutionState))) {
    errors.push('resolution_states inválidas');
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0 || raw.steps.length > MAX_STEPS) {
    errors.push(`steps deve ter 1..${MAX_STEPS} itens`);
  } else {
    const seen = new Set<string>();
    raw.steps.forEach((step, index) => {
      if (!isPlainObject(step)) { errors.push(`step ${index} precisa ser objeto`); return; }
      if (!isNonEmptyString(step.id) || !keyPattern(step.id)) { errors.push(`step ${index}: id inválido`); return; }
      if (seen.has(step.id)) { errors.push(`step ${index}: id duplicado ${step.id}`); return; }
      seen.add(step.id);
      if (!STEP_KINDS.includes(step.kind as PlaybookStepKind)) errors.push(`step ${step.id}: kind inválido`);
      if (!isNonEmptyString(step.title) || !boundedLength(step.title, 3, LIMITS.title.max)) errors.push(`step ${step.id}: title inválido`);
      if (!isNonEmptyString(step.description) || !boundedLength(step.description, 3, LIMITS.text.max)) errors.push(`step ${step.id}: description inválida`);
      if (step.kind === 'approval') {
        const design = step.approval_design;
        if (!isPlainObject(design)) { errors.push(`step ${step.id}: approval_design obrigatório`); }
        else {
          if (!isNonEmptyString(design.question) || !boundedLength(design.question, LIMITS.item.min, LIMITS.item.max)) errors.push(`step ${step.id}: question inválida`);
          if (!Array.isArray(design.response_fields) || design.response_fields.length < 1 || design.response_fields.length > 3
            || !design.response_fields.every((field: unknown) => isPlainObject(field)
              && isNonEmptyString((field as Record<string, unknown>).id) && keyPattern(String((field as Record<string, unknown>).id))
              && ['boolean', 'text'].includes(String((field as Record<string, unknown>).kind))
              && typeof (field as Record<string, unknown>).required === 'boolean')) {
            errors.push(`step ${step.id}: response_fields inválidos`);
          }
          if (!isNonEmptyString(design.timeout_policy) || !boundedLength(design.timeout_policy, LIMITS.item.min, LIMITS.item.max)) errors.push(`step ${step.id}: timeout_policy inválida`);
        }
      }
      if (step.kind === 'internal_task') {
        const task = step.authorized_task;
        if (!isPlainObject(task) || !isNonEmptyString(task.title) || !boundedLength(task.title, 3, LIMITS.title.max)
          || !isNonEmptyString(task.idempotency_basis) || !boundedLength(task.idempotency_basis, LIMITS.item.min, LIMITS.item.max)) {
          errors.push(`step ${step.id}: authorized_task obrigatório (tarefa interna autorizada)`);
        }
      }
      if (step.kind === 'context_read') {
        if (step.sources !== undefined && (!Array.isArray(step.sources) || step.sources.length > 6 || !step.sources.every(item => isNonEmptyString(item) && boundedLength(item, LIMITS.item.min, LIMITS.item.max)))) {
          errors.push(`step ${step.id}: sources inválidas (até 6)`);
        }
      }
    });
    const last = raw.steps[raw.steps.length - 1];
    if (isPlainObject(last) && last.kind !== 'finalize') errors.push('último step deve ser finalize');
    const finalizeCount = raw.steps.filter(step => isPlainObject(step) && step.kind === 'finalize').length;
    if (finalizeCount !== 1) errors.push('exatamente um step finalize é obrigatório');
    if (raw.steps.some((step, index) => isPlainObject(step) && step.requires_approval === true && step.kind !== 'approval')) {
      errors.push('somente steps de approval podem usar requires_approval');
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, definition: raw as unknown as PlaybookDefinition };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function playbookDigest(definition: PlaybookDefinition): string {
  return crypto.createHash('sha256').update(stableStringify(definition)).digest('hex');
}

const APPROVAL_NOTES = 'Aprovação é decisão de humano nesta tela/no fluxo de aprovação existente; nenhum efeito é executado pela prévia.';
const CONDITION_NOTES = 'Filtro determinístico; nenhuma inferência de IA é usada para decidir a condição.';

function previewNoteFor(step: PlaybookStep): string {
  switch (step.kind) {
    case 'context_read': return 'Somente leitura do contexto do próprio workspace.';
    case 'condition': return CONDITION_NOTES;
    case 'approval': return APPROVAL_NOTES;
    case 'internal_task': return 'Somente tarefa interna criada após aprovação registrada; sem contato ao cliente.';
    case 'finalize': return 'Encerra a execução com estado de resolução registrado.';
  }
}

export function buildPlaybookPreview(
  definition: PlaybookDefinition,
  gates: { featureKey: string; featureState: PlaybookGateState } = { featureKey: 'proposal_recovery', featureState: 'unknown' },
): PlaybookPreview {
  const steps: PlaybookPreviewStep[] = definition.steps.map(step => ({
    id: step.id,
    kind: step.kind,
    title: step.title,
    description: step.description,
    requires_approval: step.requires_approval === true || step.kind === 'approval',
    preview_note: previewNoteFor(step),
  }));
  const internalEffects = definition.steps
    .filter(step => step.kind === 'internal_task' && step.authorized_task)
    .map(step => `tarefa interna: ${step.authorized_task!.title} (idempotência ${step.authorized_task!.idempotency_basis})`);
  return {
    playbook_key: definition.key,
    version: definition.version,
    digest: playbookDigest(definition),
    title: definition.title,
    when_to_use: definition.when_to_use,
    not_when: definition.not_when,
    trigger: definition.trigger,
    entry_signal: definition.entry_signal,
    steps,
    approval_points: definition.steps
      .filter(step => step.kind === 'approval' && step.approval_design)
      .map(step => ({
        step_id: step.id,
        question: step.approval_design!.question,
        response_fields: step.approval_design!.response_fields,
        timeout_policy: step.approval_design!.timeout_policy,
      })),
    effects: {
      internal: internalEffects,
      external: [],
      blocked: definition.blocked_effects,
    },
    execution_status: 'not_available_in_r1',
    resolution_states: definition.resolution_states,
    gate: { feature_key: gates.featureKey, state: gates.featureState },
  };
}

// Definição publicada R1 — propriedade do código, revisável por revisão de
// código. Digest muda com o conteúdo; runs futuros devem fixar o digest vistos.
const PROPOSAL_RECOVERY_DEF: PlaybookDefinition = {
  key: 'proposal_recovery',
  version: 'R1',
  title: 'Recuperação de proposta sem resposta',
  when_to_use: 'Propostas enviadas sem decisão registrada, nas quais você quer organizar o acompanhamento interno e registrar o resultado com aprovação humana.',
  not_when: [
    'A proposta foi aprovada, rejeitada ou arquivada',
    'Você não é administrador da empresa que detém a conversa',
    'Você quer enviar mensagem, aplicar desconto ou alterar cobrança automaticamente',
  ],
  trigger: { family: 'manual', label: 'Início manual, a partir de um sinal do Radar (proposta sem resposta)' },
  entry_signal: { source: 'radar', kind: 'unanswered_proposal' },
  steps: [
    {
      id: 'read_context',
      kind: 'context_read',
      title: 'Consultar contexto da proposta',
      description: 'Leitura do histórico próprio: dados da proposta, negócio vinculado e mensagens da conversa.',
      sources: ['proposal', 'linked_deal', 'conversation_messages'],
    },
    {
      id: 'check_window',
      kind: 'condition',
      title: 'Verificar janela de acompanhamento',
      description: 'Proposta enviada há 48 horas ou mais sem aprovação, rejeição ou arquivamento — a mesma regra conservadora do Radar.',
    },
    {
      id: 'request_approval',
      kind: 'approval',
      requires_approval: true,
      title: 'Aprovar tarefa de acompanhamento',
      description: 'Decisão humana de criar a tarefa interna, registrada com campos estruturados.',
      approval_design: {
        question: 'Criar tarefa interna de follow-up para esta proposta (sem contato ao cliente)?',
        response_fields: [
          { id: 'approved', kind: 'boolean', required: true },
          { id: 'justification', kind: 'text', required: false },
        ],
        timeout_policy: 'Espera registrada em auditoria; sem alerta automático e sem ação externa na R1',
      },
    },
    {
      id: 'create_followup_task',
      kind: 'internal_task',
      title: 'Criar tarefa interna de follow-up',
      description: 'Nomeia o executor autorizado: cria a tarefa no quadro existente e encadeia o registro da decisão.',
      authorized_task: {
        title: 'Acompanhar proposta sem resposta',
        idempotency_basis: 'approved-action:<actionId>',
      },
    },
    {
      id: 'record_result',
      kind: 'finalize',
      title: 'Registrar resultado',
      description: 'Execução termina em um dos três estados registrados, nunca silenciosamente incompleta.',
    },
  ],
  external_effects: [],
  blocked_effects: [
    'Envio de mensagem ao cliente (WhatsApp, e-mail, SMS)',
    'Alteração de preço, desconto ou condição da proposta',
    'Ação financeira (contratação, cobrança, cobrança manual / interna)',
    'Chamada paga ao modelo sem política Pulso aprovada, tarifa confirmada e reserva',
  ],
  resolution_states: ['succeeded', 'assumed_by_human', 'escalated'],
};

const VALID_R1 = validatePlaybookDefinition(PROPOSAL_RECOVERY_DEF);
if (!VALID_R1.ok) {
  const details = 'errors' in VALID_R1 ? VALID_R1.errors.join('; ') : 'falha desconhecida';
  throw new Error(`Definição interna inválida: ${details}`);
}

export const PLAYBOOK_KEYS: readonly string[] = ['proposal_recovery'];

export function getPlaybookDefinition(key: string): PlaybookDefinition | null {
  if (!keyPattern(key)) return null;
  return key === 'proposal_recovery' ? PROPOSAL_RECOVERY_DEF : null;
}
