import { loadEnvConfig } from "@next/env";
import { bootstrapAdmin } from "../src/server/accounts/provisioning";
import { getPasswordService } from "../src/server/auth/passwords";
import { openNativeDatabase } from "./lib/native-database";
import { readBootstrapInteractively,readStdinJson } from "./lib/secret-input";
async function main(){
  loadEnvConfig(process.cwd(),process.env.NODE_ENV!=="production");
  const args=new Set(process.argv.slice(2));
  if([...args].some((v)=>!["--apply","--allow-remote","--stdin"].includes(v)))throw new Error("INVALID_ARGUMENT_PASSWORD_MUST_NOT_BE_CLI_ARGUMENT");
  if(!args.has("--apply")){console.log("Mode rencana: tidak terhubung database atau membuat admin. Gunakan --apply, input TTY tersembunyi atau --stdin JSON.");return;}
  const connection=process.env.BOOTSTRAP_DATABASE_URL;if(!connection)throw new Error("BOOTSTRAP_DATABASE_URL_REQUIRED");
  const url=new URL(connection),local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if(!["postgres:","postgresql:"].includes(url.protocol))throw new Error("INVALID_DATABASE_URL");
  if(!local&&!args.has("--allow-remote"))throw new Error("REMOTE_APPLY_REQUIRES_EXPLICIT_FLAG");
  const input=await(args.has("--stdin")?readStdinJson():readBootstrapInteractively());
  const database=openNativeDatabase(connection,!local);
  try{const result=await bootstrapAdmin(database,await getPasswordService(),input);console.log(JSON.stringify({ok:true,userId:result.userId,status:result.created?"created_requires_password_change":"already_exists_unchanged"}));}
  finally{await database.close();}
}
main().catch((error:unknown)=>{
  const message=error instanceof Error&&/^[A-Z_]+$/u.test(error.message)?error.message:"BOOTSTRAP_FAILED";
  console.error(message);process.exitCode=1;
});
