import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LaunchPlanningPanel} from '../src/components/internal/LaunchPlanningPanel.js';
import {DEFAULT_FINANCE_ASSUMPTIONS} from '../backend/finance/finance-model.js';
test('founder planning starts without fabricated inputs, labels session-only simulations and preserves unavailable costs',()=>{
 const html=renderToStaticMarkup(createElement(LaunchPlanningPanel,{assumptions:DEFAULT_FINANCE_ASSUMPTIONS,scenario:'base'}));
 assert.equal((html.match(/<input/g)||[]).length,14);
 assert.equal((html.match(/value=""/g)||[]).length,14);
 assert.match(html,/Simulações internas do fundador/);assert.match(html,/somente nesta sessão/);
 assert.match(html,/Valores ausentes não serão considerados zero/);assert.doesNotMatch(html,/<table/);
 assert.doesNotMatch(html,/javascript:|localStorage|fetch\(/);
});
