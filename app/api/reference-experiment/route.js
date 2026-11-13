import { referenceExperimentContext, generateReferenceExperiment } from '@/lib/referenceExperiment';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let running = false;
const reply = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || new URL(request.url).host;
  try { if (origin && new URL(origin).host !== host) return reply({ error: 'Origem não permitida.' }, 403); } catch { return reply({ error: 'Origem não permitida.' }, 403); }
  const raw = await request.text();
  if (raw.length > 8192) return reply({ error: 'Pedido muito grande.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'Pedido inválido.' }, 400); }
  if (!['preview', 'generate'].includes(body?.action)) return reply({ error: 'Ação inválida.' }, 400);
  let context;
  try { context = await referenceExperimentContext(body); } catch { return reply({ error: 'Escolha dois materiais válidos e uma provocação de até 750 caracteres.' }, 400); }
  if (body.action === 'preview') { const { context: _context, baseKnowledge: _base, collectiveInfluence: _influence, ...trace } = context; return reply({ ...trace, kind: 'preview' }); }
  if (running) return reply({ error: 'Já há um experimento sendo gerado. Aguarde.' }, 409);
  running = true;
  try { return reply(await generateReferenceExperiment(context, { signal: request.signal })); }
  catch (error) { return reply({ error: process.env.OPENAI_API_KEY ? 'Não foi possível concluir a improvisação. Tente novamente.' : 'Modelo não configurado. Você pode explorar o contexto sem gerar uma fala.' }, 502); }
  finally { running = false; }
}
