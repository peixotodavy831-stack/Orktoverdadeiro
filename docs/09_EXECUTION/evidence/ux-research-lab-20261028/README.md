# Evidências do UX Research Lab

Execução local em 29/10/2026, grupo de artefatos iniciado em28/10. O nome do diretório não é a data de cada execução: usar generatedAt/startedAt nos JSONs (UTC).

- before: produto c289f78, adaptador de teste calibrado na árvore local; 8 jornadas PASS +8 testes de usabilidade FAIL, matriz56. Não é um checkout limpo do adaptador.
- after-attempt-1: primeira correção intermediária, 15PASS/1FAIL (formulário curto ainda coberto pelo dock). É histórico, não estado final.
- after: runtime04d24c9, 16PASS/1FAIL; C falhou em page.goto após5s, antes de ações. Matriz56 sem overflow horizontal.
- after-recheck-C-conversation-draft: C reexecutado PASS, ferramentas cf4cf4d, src idêntico a04d24c9.
- after-recheck-UX10-desktop-enter: teste adicional desktop/Shift+Enter/IME PASS, contra fixture503.
- after-recheck-UX04-old-approval: f293848, contador1 e pendência antiga confirmados; captura nova com nome único e status explícito.
- visual-review: oito capturas atuais, dois temas e três classes de dispositivo, cf4cf4d; captura não tem fallback silencioso. Aparelhos emulados, sem dispositivo físico.
- personas: dez leituras independentes iniciais e dez reavaliações sintéticas, não entrevistas reais.
- validation: saída de testes/build/typecheck e rodadas; credenciais não são usadas.

Limitação descoberta: o runner inicial ignorava falha de screenshot. after/UX04-old-approval.png é uma imagem anterior à execução declarada no JSON; preservada como histórico, **excluída das conclusões visuais finais**. Usar a captura nomeada no JSON do recheck UX04. Os demais PNGs de before/after foram conferidos por mtime contra startedAt; metadados temporais e hashes constam no índice. O runner final usa nome único, timeout explícito e resultado de captura, impedindo reaproveitamento silencioso.

O timeout C e a falha de captura não foram apagados nem convertidos em PASS retroativo. A primeira execução paralela das ferramentas teve um timeout em staging-diagnostics; a suíte serial existente passou108/108. O novo teste de rascunhos inicialmente tinha import ESM sem.js; corrigido em4154ce8, depois410/410+108/108 passaram. Não são falhas de fornecedor.

Nenhum artefato comprova login Google, PostgREST real, Edge real, entrega Meta, Asaas ou inferência de IA. READY_FOR_PRODUCTION_CANDIDATE=NO.
