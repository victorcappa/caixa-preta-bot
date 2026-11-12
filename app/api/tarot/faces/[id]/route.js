import {preparedBytes} from '@/lib/tarot/face-store';
export const runtime='nodejs';
export async function GET(request,{params}){try{const {bytes}=await preparedBytes((await params).id);return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Recurso indisponível',{status:404});}}
