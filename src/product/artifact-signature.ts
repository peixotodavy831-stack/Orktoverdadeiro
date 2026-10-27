/** Fixed first-party assets only. No customer input or remote tracking in branding. */
export const ARTIFACT_SIGNATURE = {
 label:'Criado com ORKTO',symbol:'/brand/orkto-symbol.svg',wordmark:'/brand/orkto-wordmark.svg',
} as const;

/** Standalone print document; no external links, tracking or executable content. */
export function artifactSignaturePrintHtml():string{
 return '<footer aria-label="Criado com ORKTO" style="margin-top:32px;display:flex;justify-content:flex-end;align-items:center;gap:7px;color:#625c55;font:11px Arial,sans-serif;break-inside:avoid"><span>Criado com</span><img src="/brand/orkto-symbol.svg" alt="" width="20" height="20"><img src="/brand/orkto-wordmark.svg" alt="ORKTO" width="76" height="18" style="filter:brightness(0)"></footer>';
}
