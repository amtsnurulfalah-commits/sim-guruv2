import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
export async function readStdinJson():Promise<unknown>{
  let input="";
  for await(const chunk of process.stdin){input+=String(chunk);if(Buffer.byteLength(input)>16_384)throw new Error("BOOTSTRAP_INPUT_TOO_LARGE");}
  try{return JSON.parse(input) as unknown;}catch{throw new Error("BOOTSTRAP_JSON_INVALID");}
}
function hiddenPassword(prompt:string):Promise<string>{
  if(!process.stdin.isTTY || !process.stdout.isTTY)throw new Error("TTY_OR_STDIN_REQUIRED");
  return new Promise((resolve,reject)=>{
    const wasRaw=Boolean(process.stdin.isRaw);let password="";
    emitKeypressEvents(process.stdin);process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
    const finish=(error?:Error)=>{process.stdin.removeListener("keypress",onKey);process.stdin.setRawMode(wasRaw);process.stdin.pause();process.stdout.write("\n");if(error)reject(error);else resolve(password);};
    const onKey=(character:string|undefined,key:{name?:string;ctrl?:boolean;meta?:boolean})=>{
      if(key.ctrl && key.name==="c")return finish(new Error("BOOTSTRAP_CANCELLED"));
      if(key.name==="return" || key.name==="enter")return finish();
      if(key.name==="backspace"){password=Array.from(password).slice(0,-1).join("");return;}
      if(character && !key.ctrl && !key.meta && !Array.from(character).some(char=>char.codePointAt(0)!<32 || char.codePointAt(0)===127)){password+=character;if(Array.from(password).length>128)finish(new Error("PASSWORD_TOO_LONG"));}
    };
    process.stdin.on("keypress",onKey);
  });
}
export async function readBootstrapInteractively():Promise<unknown>{
  if(!process.stdin.isTTY || !process.stdout.isTTY)throw new Error("TTY_OR_STDIN_REQUIRED");
  const rl=createInterface({input:process.stdin,output:process.stdout});
  const username=await rl.question("Username admin: ");const fullName=await rl.question("Nama lengkap admin: ");rl.close();
  const temporaryPassword=await hiddenPassword("Password sementara (minimal20 karakter; input disembunyikan, kosong untuk cek ulang target): ");
  if(!temporaryPassword)return {username,fullName};
  const confirmed=await hiddenPassword("Ulangi password sementara: ");
  if(temporaryPassword!==confirmed)throw new Error("PASSWORD_CONFIRMATION_MISMATCH");
  return {username,fullName,temporaryPassword};
}
