import { test } from '../../readiness/staging-safe-test';

test('failed HTTPS request never leaks headers into reports or artifacts', async ({ request }) => {
  test.fail();
  await request.get(process.env.ORKTO_TEST_TLS_URL!, { maxRedirects: 0, headers: {
    Authorization: `Bearer ${process.env.ORKTO_TEST_ACCESS_TOKEN}`,
    'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN!,
  } });
});

test('failed assertion never leaks passwords or keys into reports or artifacts', async () => {
  test.fail();
  throw new Error(JSON.stringify({ password: process.env.ORKTO_STAGING_E2E_USER_A_PASSWORD,
    secret: process.env.ORKTO_TEST_SECRET_KEY, access_token: process.env.ORKTO_TEST_ACCESS_TOKEN })
    + '\n' + ['opaque', 'unrecognized', 'sensitive', 'fixture', 'value'].join('-'));
});
