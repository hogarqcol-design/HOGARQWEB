'use strict';
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
function endpoint(method, fn) {
  return async (req, res) => {
    try {
      if (req.method !== method) {
        res.setHeader('Allow', method);
        throw new HttpError(405, 'Método no permitido.');
      }
      await fn(req, res);
    } catch (error) {
      // Never log request bodies, provider responses, addresses, or credentials.
      if (!(error instanceof HttpError)) console.error('hogarq_api_failure', error.name);
      json(res, error.status || 503, {error: error.status ? error.message : 'No pudimos completar la solicitud. Intenta de nuevo o escríbenos por Instagram.'});
    }
  };
}
async function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Envía datos JSON.');
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else {
    raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 16000) throw new HttpError(413, 'La solicitud es demasiado grande.');
    }
  }
  if (Buffer.byteLength(raw) > 16000) throw new HttpError(413, 'La solicitud es demasiado grande.');
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Datos inválidos.'); }
}
async function request(url, options = {}) {
  const response = await fetch(url, {...options, signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Provider request failed');
  return response.json();
}
module.exports = {HttpError, json, endpoint, body, request};
