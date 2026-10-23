import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'tailwindcss';

test('dark utilities follow the product class toggle rather than the device preference',async()=>{
 const source=readFileSync(resolve('src/index.css'),'utf8');
 const directive=source.match(/@custom-variant dark[^;]+;/)?.[0];
 assert.ok(directive,'Tailwind 4 needs a custom variant to override media-driven dark mode');
 const compiler=await compile(`@theme { --color-white: #fff; } ${directive} @tailwind utilities;`);
 const css=compiler.build(['dark:text-white']);
 assert.match(css,/:where\(\.dark, \.dark \*\)/);
 assert.doesNotMatch(css,/prefers-color-scheme/);
});
