import { showState } from '@/lib/showState';
import { sameOrigin } from '@/lib/tarot/http';
import { createOperatorPreferenceStore } from '@/lib/operatorPreferences';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  return Response.json({...(showState.operatorPreferencesStatus?.()||createOperatorPreferenceStore().status()),runtimeReady:Boolean(showState._refreshOperatorPreferences)}, {headers:{'Cache-Control':'no-store'}});
}
export async function POST(request) {
  if(!sameOrigin(request))return Response.json({error:'ORIGIN_NOT_ALLOWED'},{status:403});
  const body=await request.json().catch(()=>null);
  if(body?.action!=='save-current')return Response.json({error:'OPERATOR_PREFERENCES_ACTION_UNKNOWN'},{status:400});
  if(body.sessionId!==showState.snapshot().reliability.sessionId)return Response.json({error:'SHOW_SESSION_CHANGED'},{status:409});
  try {
    const adapter=createOperatorPreferenceStore();
    const status=showState._refreshOperatorPreferences?showState._refreshOperatorPreferences(adapter):adapter.save(showState.privateSnapshot());
    return Response.json({...status,runtimeReady:Boolean(showState._refreshOperatorPreferences)});
  }catch {return Response.json({error:'OPERATOR_PREFERENCES_SAVE_FAILED'},{status:500});}
}
