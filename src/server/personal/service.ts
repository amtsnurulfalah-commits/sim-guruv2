import 'server-only';
import type { SqlDatabase } from '../../../scripts/lib/sql-database';
import { AuthError, tokenHash } from '../auth/service';
import { calendarSchema, historySchema, rangeSchema } from '../../lib/personal/contracts';
export class PersonalService {
 constructor(private readonly db:SqlDatabase){}
 async read(token:string,kind:'calendar'|'history',input:unknown){
  const q=rangeSchema.parse(input);
  return this.db.transaction(async tx=>{
   const result=(await tx.query<{value:unknown}>(kind==='calendar'?'select app.personal_calendar($1,$2::date,$3::date) value':'select app.personal_history($1,$2::date,$3::date) value',[tokenHash(token),q.from,q.to])).rows[0]!.value;
   const parsed=kind==='calendar'?calendarSchema.safeParse(result):historySchema.safeParse(result);
   if(!parsed.success)throw new AuthError('INVALID_RESPONSE',502);
   return parsed.data;
  });
 }
}
