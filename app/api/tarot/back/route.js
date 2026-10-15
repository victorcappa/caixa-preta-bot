import { backReferenceBytes } from "@/lib/tarot/catalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{const {bytes,mime}=await backReferenceBytes();return new Response(bytes,{headers:{"content-type":mime,"Cache-Control":"no-cache"}});}catch{return new Response(null,{status:404});}}
