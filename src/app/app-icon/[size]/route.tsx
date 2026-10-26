import {ImageResponse} from 'next/og';
export const dynamic='force-static';
export async function GET(_request:Request,context:{params:Promise<{size:string}>}){const {size}=await context.params;if(!['192','512'].includes(size))return new Response('Not found',{status:404});const dimension=Number(size);return new ImageResponse(<svg width={dimension} height={dimension} viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#146248"/><path d="M14 18h15c3 0 5 2 5 4v26c-2-3-4-4-7-4H14zm36 0H36v30c2-3 4-4 7-4h7z" fill="#fff"/></svg>,{width:dimension,height:dimension});}
