import {sourcePhoto} from '@/lib/tarot/face-store';
export const runtime='nodejs';
export async function GET(request){try{const id=new URL(request.url).searchParams.get('id'),bytes=await sourcePhoto(id);return new Response(bytes,{headers:{'Content-Type':/\.png$/i.test(id)?'image/png':/\.webp$/i.test(id)?'image/webp':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Fotografia indisponível',{status:404});}}
