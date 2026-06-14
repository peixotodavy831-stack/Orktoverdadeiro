import { Quote } from '../types';
import { formatBRL } from '../utils/format';

/**
 * Creates a new Google Spreadsheet and populates it with Quotes data.
 * @returns The spreadsheet URL
 */
export async function exportQuotesToSheets(accessToken: string, quotes: Quote[]): Promise<string> {
  // 1. Create a new Spreadsheet
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: ` Orkto - Gestão de Orçamentos (${new Date().toLocaleDateString('pt-BR')})`,
      },
    }),
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create Google Spreadsheet: ${errText}`);
  }

  const createData = await createResponse.json();
  const { spreadsheetId, spreadsheetUrl } = createData;
  const sheetName = createData.sheets?.[0]?.properties?.title || 'Sheet1';

  // Helper to safely convert raw/untyped timestamp values to milliseconds
  const getTimestampMillis = (ts: any): number => {
    if (!ts) return Date.now();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts.seconds !== undefined) return ts.seconds * 1000;
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime();
    return Date.now();
  };

  // 2. Format the data to insert
  const headers = ['ID', 'Data de Criação', 'Nº Proposta', 'Estabelecimento', 'Cliente', 'WhatsApp', 'Serviço/Escopo', 'Total', 'Status'];
  const rows = quotes.map((quote) => [
    quote.id,
    new Date(getTimestampMillis(quote.createdAt)).toLocaleDateString('pt-BR'),
    `#${quote.quoteNumber}`,
    quote.clientCompany || '',
    quote.clientName,
    quote.clientPhone,
    quote.clientVehicleOrService || '',
    formatBRL(quote.total),
    quote.status === 'approved' ? 'Aprovado' : quote.status === 'rejected' ? 'Recusado' : 'Pendente',
  ]);

  const values = [headers, ...rows];

  // 3. Write data to the spreadsheet
  const range = `${sheetName}!A1:I${values.length}`;
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    }
  );

  if (!updateResponse.ok) {
    const errText = await updateResponse.text();
    throw new Error(`Failed to write values to spreadsheet: ${errText}`);
  }

  return spreadsheetUrl;
}

/**
 * Sends a HTML email template via Gmail API.
 */
export async function sendQuoteEmailViaGmail(
  accessToken: string,
  toEmail: string,
  subject: string,
  bodyHtml: string
): Promise<void> {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailContent = [
    `To: ${toEmail}`,
    'Content-Type: text/html; charset=utf-8',
    'Mime-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    bodyHtml,
  ].join('\r\n');

  // Convert content to base64url format
  const bytes = new TextEncoder().encode(emailContent);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const rawBase64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: rawBase64,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to send email via Gmail: ${errText}`);
  }
}
