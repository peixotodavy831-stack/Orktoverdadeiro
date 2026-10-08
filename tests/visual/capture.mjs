import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(root, 'artifacts');
const baseUrl = process.env.ORKTO_VISUAL_BASE_URL || 'http://127.0.0.1:4173/tests/visual/index.html';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const sizes = [
  { name: '390', width: 390, height: 844, mobile: true },
  { name: '768', width: 768, height: 1024, mobile: true },
  { name: '1280', width: 1280, height: 900, mobile: false },
  { name: '1440', width: 1440, height: 900, mobile: false },
];
const screens = ['today', 'inbox', 'deals', 'wia'];
const themes = ['light', 'dark'];
const report = { generatedAt: new Date().toISOString(), baseUrl, captures: [], interactions: [], issues: [] };
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--disable-gpu'] });

function pageUrl(screen, theme, options = {}) {
  const url = new URL(baseUrl);
  url.searchParams.set('screen', screen);
  url.searchParams.set('theme', theme);
  if (options.thread) url.searchParams.set('thread', '1');
  if (options.scenario) url.searchParams.set('scenario', options.scenario);
  return url.toString();
}

async function openCase(screen, theme, size, options = {}) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.mobile,
    hasTouch: size.mobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(pageUrl(screen, theme, options), { waitUntil: 'domcontentloaded' });
  await page.locator('[data-visual-screen]').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(180);
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    theme: document.querySelector('[data-visual-theme]')?.getAttribute('data-visual-theme'),
    unnamedButtons: Array.from(document.querySelectorAll('button')).filter(button => {
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return !button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby') && !button.innerText.trim() && !button.getAttribute('title');
    }).map(button => button.outerHTML.slice(0, 240)),
    smallTouchTargets: Array.from(document.querySelectorAll('button')).map(button => {
      const rect = button.getBoundingClientRect();
      return { name: button.getAttribute('aria-label') || button.innerText.trim().replace(/\s+/g, ' ').slice(0, 72) || button.title, width: Math.round(rect.width), height: Math.round(rect.height) };
    }).filter(button => button.width > 0 && button.height > 0 && (button.width < 44 || button.height < 44)),
  }));
  assert.equal(dimensions.viewport, size.width, `${screen} ${size.name}px viewport did not apply`);
  assert.ok(dimensions.documentWidth <= size.width + 1, `${screen} ${size.name}px ${theme} overflows horizontally: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.bodyWidth <= size.width + 1, `${screen} ${size.name}px ${theme} body overflows horizontally: ${JSON.stringify(dimensions)}`);
  assert.equal(dimensions.theme, theme, `${screen} did not apply ${theme} theme`);
  assert.deepEqual(pageErrors, [], `${screen} ${size.name}px ${theme} threw browser errors`);
  if (dimensions.unnamedButtons.length) report.issues.push({ screen, size: size.name, theme, kind: 'unnamed-button', details: dimensions.unnamedButtons });
  if (size.mobile && dimensions.smallTouchTargets.length) report.issues.push({ screen, size: size.name, theme, kind: 'small-touch-target', details: dimensions.smallTouchTargets });
  if (options.capture !== false) {
    const scenarioTag = options.thread ? '-conversation' : '';
    const file = `${screen}${scenarioTag}-${size.name}-${theme}.png`;
    await page.screenshot({ path: path.join(outputDir, file), animations: 'disabled' });
    report.captures.push({ file, screen, width: size.width, height: size.height, theme, documentHeight: dimensions.documentHeight, pageErrors });
  }
  return { context, page, dimensions };
}

await mkdir(outputDir, { recursive: true });
try {
  if (process.env.ORKTO_VISUAL_SKIP_MATRIX !== '1') {
    for (const screen of screens) {
      for (const size of sizes) {
        for (const theme of themes) {
          await (await openCase(screen, theme, size)).context.close();
        }
      }
    }

    for (const sizeName of ['390', '768']) {
      const size = sizes.find(item => item.name === sizeName);
      for (const theme of themes) {
        await (await openCase('inbox', theme, size, { thread: true })).context.close();
      }
    }
  }

  const mobile = sizes[0];
  const navCase = await openCase('today', 'dark', mobile, { capture: false });
  const { page } = navCase;
  const quickCreateTrigger = page.getByRole('button', { name: 'Criar novo' });
  await quickCreateTrigger.click();
  const quickCreateDialog = page.getByRole('dialog', { name: 'Criar novo' });
  await quickCreateDialog.waitFor({ state: 'visible' });
  for (const label of ['Novo cliente', 'Novo negócio', 'Nova proposta']) {
    assert.ok(await quickCreateDialog.getByRole('button', { name: new RegExp(label) }).count(), `Quick create is missing ${label}`);
  }
  const interactionAction = quickCreateDialog.getByRole('button', { name: /Nova interação/ });
  assert.ok(await interactionAction.count(), 'Quick create is missing Nova interação');
  assert.equal(await interactionAction.isEnabled(), false, 'Nova interação should stay disabled until its opening contract exists');
  await page.keyboard.press('Shift+Tab');
  assert.match(await page.evaluate(() => document.activeElement?.innerText || ''), /Nova proposta/, 'Quick-create focus should wrap from first to last action');
  await page.keyboard.press('Escape');
  await quickCreateDialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Criar novo', 'Escape did not restore focus to the quick-create trigger');
  const quickFile = 'mobile-quick-create-390-dark.png';
  await quickCreateTrigger.click();
  await page.screenshot({ path: path.join(outputDir, quickFile), animations: 'disabled' });
  report.captures.push({ file: quickFile, screen: 'mobile-navigation', width: 390, height: 844, theme: 'dark' });
  report.interactions.push({ name: 'mobile quick create', result: 'passed', keyboard: 'Escape closes and restores trigger focus' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const moduleDialog = page.getByRole('dialog', { name: 'Módulos' });
  await moduleDialog.waitFor({ state: 'visible' });
  for (const label of ['Clientes', 'Propostas', 'Catálogo', 'Relatórios', 'Integrações', 'Equipe', 'Plano & Cobrança', 'Configurações', 'Perfil']) {
    assert.ok(await moduleDialog.getByText(label, { exact: true }).count(), `Mobile module menu is missing ${label}`);
  }
  await page.keyboard.press('Shift+Tab');
  assert.match(await page.evaluate(() => document.activeElement?.innerText || ''), /Sair/, 'Expanded-menu focus should wrap from first to last action');
  await page.keyboard.press('Escape');
  await moduleDialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Abrir menu', 'Escape did not restore focus to the module-menu trigger');
  report.interactions.push({ name: 'mobile expanded menu', result: 'passed', keyboard: 'Escape closes the modal sheet' });
  await page.getByRole('button', { name: 'Ativar tema claro' }).click();
  assert.equal(await page.locator('[data-visual-screen]').getAttribute('data-visual-theme'), 'light', 'Mobile theme toggle did not switch to light');
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  assert.equal(await page.locator('[data-visual-screen]').getAttribute('data-visual-theme'), 'dark', 'Mobile theme toggle did not switch back to dark');
  report.interactions.push({ name: 'mobile theme toggle', result: 'passed', themes: ['light', 'dark'] });
  await navCase.context.close();

  const inboxContext = await openCase('inbox', 'light', mobile, { thread: true, capture: false });
  await inboxContext.page.getByRole('button', { name: 'Abrir contexto comercial e WIA' }).click();
  const contextDialog = inboxContext.page.getByRole('dialog', { name: 'Contexto da conversa' });
  await contextDialog.waitFor({ state: 'visible' });
  await inboxContext.page.keyboard.press('Shift+Tab');
  assert.match(await inboxContext.page.evaluate(() => document.activeElement?.innerText || ''), /Negócio vinculado/, 'Context drawer focus should wrap from first to last action');
  await inboxContext.page.keyboard.press('Escape');
  await contextDialog.waitFor({ state: 'hidden' });
  assert.equal(await inboxContext.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Abrir contexto comercial e WIA', 'Escape did not restore focus to the context trigger');
  report.interactions.push({ name: 'Inbox mobile context drawer', result: 'passed', keyboard: 'drawer closes with Escape' });
  await inboxContext.context.close();

  const dealPeek = await openCase('deals', 'light', mobile, { capture: false });
  await dealPeek.page.getByRole('button', { name: /Renovação do contrato de manutenção/ }).click();
  const dealDialog = dealPeek.page.getByRole('dialog', { name: /Renovação do contrato de manutenção/ });
  await dealDialog.waitFor({ state: 'visible' });
  const stageMover = dealDialog.getByLabel('Mover para…');
  assert.ok(await stageMover.count(), 'Deal side peek is missing its non-drag stage mover');
  await stageMover.selectOption('negotiation');
  await dealPeek.page.getByRole('status').filter({ hasText: 'Negócio movido para Negociação' }).waitFor({ state: 'visible', timeoutMs: 5000 });
  await dealPeek.page.keyboard.press('Escape');
  await dealDialog.waitFor({ state: 'hidden' });
  assert.match(await dealPeek.page.evaluate(() => document.activeElement?.getAttribute('aria-label') || ''), /Abrir negócio Renovação do contrato de manutenção/, 'Closing the deal peek did not restore focus to its opener');
  report.interactions.push({ name: 'Deals side peek and stage mover', result: 'passed', confirmation: 'Fixture returned the persisted PATCH result', keyboard: 'Escape closes the peek' });
  await dealPeek.context.close();

  const pipelineCase = await openCase('deals', 'dark', sizes.find(item => item.name === '1280'), { capture: false });
  await pipelineCase.page.getByRole('button', { name: 'Pipeline', exact: true }).click();
  await pipelineCase.page.getByLabel('Pipeline de negócios').waitFor({ state: 'visible' });
  for (const stage of ['Novo', 'Qualificação', 'Proposta', 'Negociação']) {
    assert.ok(await pipelineCase.page.getByRole('region', { name: new RegExp(stage) }).count(), `Pipeline is missing the ${stage} stage`);
  }
  const pipelineDimensions = await pipelineCase.page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert.ok(pipelineDimensions.documentWidth <= pipelineDimensions.viewport + 1, `Pipeline overflows at 1280px: ${JSON.stringify(pipelineDimensions)}`);
  const pipelineFile = 'deals-pipeline-1280-dark.png';
  await pipelineCase.page.screenshot({ path: path.join(outputDir, pipelineFile), animations: 'disabled' });
  report.captures.push({ file: pipelineFile, screen: 'deals-pipeline', width: 1280, height: 900, theme: 'dark' });
  report.interactions.push({ name: 'Deals alternate pipeline view', result: 'passed', default: 'list', overflow: 'none at 1280px' });
  await pipelineCase.context.close();

  const wiaCase = await openCase('wia', 'dark', mobile, { capture: false });
  await wiaCase.page.getByLabel('Pergunta para a WIA').fill('Revise o próximo passo desta proposta.');
  await wiaCase.page.getByRole('button', { name: 'Consultar WIA' }).click();
  await wiaCase.page.getByRole('heading', { name: 'Resposta da WIA' }).waitFor({ state: 'visible', timeout: 10000 });
  assert.ok(await wiaCase.page.getByRole('heading', { name: '1. Contexto', exact: true }).count(), 'WIA result is missing the operational context section');
  assert.ok(await wiaCase.page.getByRole('heading', { name: '3. Recomendação', exact: true }).count(), 'WIA result is missing the recommendation section');
  report.interactions.push({ name: 'WIA structured analysis', result: 'passed', backend: 'test-only fixture interception' });
  await wiaCase.context.close();

  const stateCases = {
    empty: {
      today: 'Nada parado por aqui',
      inbox: 'Nenhuma conversa na Inbox',
      deals: 'Seu pipeline está vazio',
      wia: 'Nenhuma aprovação pendente',
    },
    error: {
      today: 'A fila da Inbox não carregou',
      inbox: 'Não foi possível carregar as conversas',
      deals: 'Não foi possível concluir a operação',
      wia: 'Não foi possível carregar as aprovações',
    },
    permission: {
      today: 'Acesso necessário',
      inbox: 'Acesso necessário',
      deals: 'Acesso necessário',
      wia: 'Acesso necessário',
    },
    configuration: {
      today: 'Inbox precisa de configuração',
      inbox: 'Inbox precisa de configuração',
      wia: 'Configuração necessária',
    },
    backend_pending: {
      today: 'Fila da Inbox pendente neste ambiente',
      inbox: 'Fila da Inbox pendente neste ambiente',
      deals: 'Negócios pendente neste ambiente',
      wia: 'Fila de aprovação pendente neste ambiente',
    },
  };
  for (const [scenario, byScreen] of Object.entries(stateCases)) {
    for (const [screen, expectedText] of Object.entries(byScreen)) {
      const stateCase = await openCase(screen, 'light', mobile, { scenario, capture: false });
      await stateCase.page.getByText(expectedText, { exact: false }).first().waitFor({ state: 'visible', timeoutMs: 5000 });
      report.stateScenarios ||= [];
      report.stateScenarios.push({ screen, scenario, result: 'passed', label: expectedText });
      await stateCase.context.close();
    }
  }

  const loadingLabels = {
    today: 'Carregando itens que precisam de atenção',
    inbox: 'Carregando conversas',
    deals: 'Carregando negócios',
    wia: 'Carregando ações que aguardam aprovação',
  };
  for (const [screen, label] of Object.entries(loadingLabels)) {
    const loadingCase = await openCase(screen, 'dark', mobile, { scenario: 'loading', capture: false });
    assert.ok(await loadingCase.page.getByRole('status', { name: label }).count(), `${screen} did not expose its loading skeleton`);
    report.stateScenarios ||= [];
    report.stateScenarios.push({ screen, scenario: 'loading', result: 'passed', label });
    await loadingCase.context.close();
  }

  const inboxSend = await openCase('inbox', 'light', mobile, { thread: true, scenario: 'configuration', capture: false });
  const composer = inboxSend.page.getByRole('textbox', { name: 'Mensagem para Marina Costa' });
  await composer.fill('Mensagem de teste visual; nenhum envio externo deve ocorrer.');
  await inboxSend.page.getByRole('button', { name: 'Enviar mensagem para Marina Costa' }).click();
  const sendAlert = inboxSend.page.getByRole('alert');
  await sendAlert.getByText('O rascunho continua disponível', { exact: false }).waitFor({ state: 'visible', timeoutMs: 5000 });
  assert.equal(await composer.evaluate(element => element.value), 'Mensagem de teste visual; nenhum envio externo deve ocorrer.', 'Inbox must preserve the draft when the channel is not configured');
  assert.ok(await inboxSend.page.getByRole('button', { name: 'Configurar canal' }).count(), 'Inbox must offer channel configuration after a backend configuration error');
  report.stateScenarios ||= [];
  report.stateScenarios.push({ screen: 'inbox', scenario: 'send-configuration-required', result: 'passed', sideEffect: 'test fixture returns 503; no external send' });
  await inboxSend.context.close();

  await writeFile(path.join(outputDir, 'matrix-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ captures: report.captures.length, interactions: report.interactions, issues: report.issues.length, report: path.join(outputDir, 'matrix-report.json') }, null, 2));
} catch (error) {
  await writeFile(path.join(outputDir, 'matrix-report.json'), JSON.stringify({ ...report, failure: error instanceof Error ? error.stack : String(error) }, null, 2) + '\n', 'utf8');
  throw error;
} finally {
  await browser.close();
}
