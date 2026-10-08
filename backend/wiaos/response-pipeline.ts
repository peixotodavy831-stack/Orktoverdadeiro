export type ResponseSurface = 'wia' | 'inbox' | 'recovery' | 'collection' | 'reactivation';
export type ResponseTone = 'cordial' | 'standard' | 'firm';

export interface ResponsePipelineInput {
  draft: string;
  surface: ResponseSurface;
  tone?: ResponseTone;
  customerName?: string;
  objectionContext?: string;
  verifiedFacts?: string[];
  sourceRefs?: string[];
}

export interface ResponsePipelineResult {
  status: 'ready' | 'blocked';
  draft: string;
  blockedReasons: string[];
  stages: string[];
  provenance: { surface: ResponseSurface; tone: ResponseTone | null; sourceRefs: string[]; policyVersion: string };
}

const normalizedDigits = (value: string) => value.replace(/\D/g, '');
const forbiddenClaimPatterns = [
  /\bgarantimos? (?:o )?resultado\b/i,
  /\bresultado garantido\b/i,
  /\b100\s*%\s*(?:seguro|garantido|de sucesso)\b/i,
  /\bsem risco\b/i,
  /\bnunca (?:falha|erra|atrasamos?)\b/i,
];

function unsupportedNumericClaims(draft: string, verifiedFacts: string[]): string[] {
  const supported = new Set(verifiedFacts.flatMap(fact => [...fact.matchAll(/R\$\s*([\d.,]+)|\b([\d.,]+)\s*%/gi)].map(match => normalizedDigits(match[1] || match[2] || ''))).filter(Boolean));
  const claims = [...draft.matchAll(/R\$\s*([\d.,]+)|\b([\d.,]+)\s*%/gi)].map(match => match[0]);
  return claims.filter(claim => !supported.has(normalizedDigits(claim)));
}

/** Deterministic WIA draft preparation. It may add a neutral style marker, but never rewrites business facts. */
export function prepareResponseDraft(input: ResponsePipelineInput): ResponsePipelineResult {
  const stages = ['raw_draft', 'business_context', 'objection_context', 'tone_policy', 'clarity_refinement', 'policy_check', 'final_draft'];
  let draft = input.draft.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).join('\n').trim();
  if (!draft) return { status: 'blocked', draft: '', blockedReasons: ['Rascunho vazio.'], stages, provenance: { surface: input.surface, tone: input.tone || null, sourceRefs: input.sourceRefs || [], policyVersion: 'response-safety-v1' } };

  const objection = input.objectionContext?.trim();
  if (objection && !/\b(entendo|compreendo|faz sentido)\b/i.test(draft)) draft = `Entendo sua preocupação. ${draft}`;

  if (input.tone === 'cordial' && !/^ol[aá][,!\s]/i.test(draft)) {
    const safeName = input.customerName?.trim().replace(/[\r\n<>]/g, '').slice(0, 80);
    draft = `${safeName ? `Olá, ${safeName}. ` : 'Olá! '}${draft}`;
  } else if (input.tone === 'firm' && !/^(objetivamente|direto ao ponto)[,:]/i.test(draft)) {
    draft = `Direto ao ponto: ${draft}`;
  }

  const blockedReasons: string[] = [];
  if (forbiddenClaimPatterns.some(pattern => pattern.test(draft))) blockedReasons.push('O texto contém uma promessa absoluta ou alegação proibida.');
  const unsupported = unsupportedNumericClaims(draft, input.verifiedFacts || []);
  if (unsupported.length) blockedReasons.push(`Valor ou percentual sem fonte verificada: ${unsupported.join(', ')}.`);

  return {
    status: blockedReasons.length ? 'blocked' : 'ready', draft, blockedReasons, stages,
    provenance: { surface: input.surface, tone: input.tone || null, sourceRefs: [...new Set(input.sourceRefs || [])].slice(0, 30), policyVersion: 'response-safety-v1' },
  };
}

export function applyResponsePipeline(input: ResponsePipelineInput): string {
  const result = prepareResponseDraft(input);
  if (result.status === 'blocked') throw Object.assign(new Error(result.blockedReasons.join(' ')), { code: 'response_policy_blocked', result });
  return result.draft;
}
