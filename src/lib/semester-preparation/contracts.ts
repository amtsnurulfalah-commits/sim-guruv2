import { z } from "zod";
export const preparationRequest = z
  .object({
    sourceId: z.uuid(),
    targetId: z.uuid(),
    configuration: z.enum(["classes", "classes_and_schedules"]),
    reason: z.string().trim().min(5,"Alasan persiapan harus berisi minimal 5 karakter.").max(500,"Alasan persiapan maksimal 500 karakter."),
  })
  .strict()
  .refine((d) => d.sourceId.toLowerCase() !== d.targetId.toLowerCase(), {
    path: ["targetId"],
    message: "Pilih semester tujuan yang berbeda.",
  });
export const commitRequest = z.object({ previewId: z.uuid() }).strict();
const klass = z.object({
  sourceId: z.uuid(),
  id: z.uuid(),
  name: z.string().trim().min(1),
  level: z.string(),
  grade: z.number().int().min(1).max(12),
  parallel: z.string(),
  expectedStudents: z.literal(0),
});
const schedule = z.object({
  sourceId: z.uuid(),
  id: z.uuid(),
  classId: z.uuid().nullable(),
  className: z.string().nullable(),
  teacher: z.string().nullable(),
  subject: z.string().nullable(),
  userId: z.uuid(),
  subjectId: z.uuid(),
  dayIndex: z.number().int().min(0).max(6),
  timeStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/),
  timeEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/),
  scheduledJtm: z.string().regex(/^\d+(?:\.\d+)?$/),
  restMinutes: z.number().int().nonnegative(),
  validFrom: z.iso.date(),
  validTo: z.iso.date(),
});
const receiptBase = z.object({
  previewId: z.uuid(),
  sourceId: z.uuid(),
  targetId: z.uuid(),
  classes: z.number().int().nonnegative(),
  schedules: z.number().int().nonnegative(),
  committedAt: z.iso.datetime({offset:true}),
  classMapping: z.array(klass),
  scheduleMapping: z.array(schedule),
});
const mappingValid = (classes: z.infer<typeof klass>[], schedules: z.infer<typeof schedule>[], allowMissing=false) => {
  const all=[...classes,...schedules], ids=all.map(row=>row.id.toLowerCase()), sources=new Set(all.map(row=>row.sourceId.toLowerCase()));
  const classIds=new Set(classes.map(row=>row.id.toLowerCase()));
  return new Set(ids).size===ids.length && ids.every(id=>!sources.has(id)) &&
    [classes,schedules].every(rows=>new Set(rows.map(row=>row.sourceId.toLowerCase())).size===rows.length) &&
    schedules.every(row=>row.classId===null ? allowMissing : classIds.has(row.classId.toLowerCase()));
};
export const receiptSchema = receiptBase.superRefine((r, c) => {
  if (
    r.classes !== r.classMapping.length ||
    r.schedules !== r.scheduleMapping.length ||
    r.sourceId.toLowerCase() === r.targetId.toLowerCase() ||
    !mappingValid(r.classMapping,r.scheduleMapping)
  )
    c.addIssue({ code: "custom", message: "PREPARATION_RECEIPT_INVALID" });
});
export const previewSchema = z.object({
  previewId: z.uuid(),
  expiresAt: z.iso.datetime({offset:true}),
  plan: z.object({
    sourceId: z.uuid().nullable(),
    targetId: z.uuid().nullable(),
    sourceDate: z.iso.date().nullable(),
    validFrom: z.iso.date().nullable(),
    validTo: z.iso.date().nullable(),
    configuration: z.enum(["classes", "classes_and_schedules"]),
    classes: z.array(klass),
    schedules: z.array(schedule),
    issues: z.array(z.string()),
  }),
  result: receiptSchema.nullable(),
}).superRefine((v,c)=>{
  const p=v.plan, clear=p.issues.length===0;
  if(!mappingValid(p.classes,p.schedules,p.issues.includes("CLASS_MISSING")) ||
    new Set(p.issues).size!==p.issues.length ||
    (p.configuration==="classes" && p.schedules.length!==0) ||
    (clear && (!p.sourceId || !p.targetId || p.sourceId.toLowerCase()===p.targetId.toLowerCase() || !p.sourceDate || !p.validFrom || !p.validTo ||
      p.sourceDate>=p.validFrom || p.validFrom>p.validTo || !p.classes.length ||
      (p.configuration==="classes_and_schedules" && !p.schedules.length) || p.classes.length>500 || p.schedules.length>2000 ||
      p.schedules.some(s=>s.validFrom!==p.validFrom || s.validTo!==p.validTo || clock(s.timeEnd)<=clock(s.timeStart) || /^0+(?:\.0+)?$/.test(s.scheduledJtm)))))
    c.addIssue({code:"custom",message:"PREPARATION_PREVIEW_INVALID"});
});
export type PreparationPreview = z.infer<typeof previewSchema>;
export type PreparationReceipt = z.infer<typeof receiptSchema>;
export const choicesSchema = z.object({
  periods: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      start: z.iso.date(),
      end: z.iso.date(),
      active: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.uuid(),
      at: z.iso.datetime({offset:true}),
      actor: z.string(),
      reason: z.string(),
      result: receiptBase.omit({ classMapping: true, scheduleMapping: true }),
    }),
  ),
}).superRefine((v,c)=>{
  if(new Set(v.periods.map(p=>p.id.toLowerCase())).size!==v.periods.length ||
    new Set(v.history.map(h=>h.id.toLowerCase())).size!==v.history.length ||
    v.periods.some(p=>p.start>p.end) || v.history.some(h=>h.id.toLowerCase()!==h.result.previewId.toLowerCase() || h.result.sourceId.toLowerCase()===h.result.targetId.toLowerCase()))
    c.addIssue({code:"custom",message:"PREPARATION_CHOICES_INVALID"});
});
export type PreparationChoices = z.infer<typeof choicesSchema>;
export const issueLabels: Record<string, string> = {
  PERIOD_INVALID:
    "Tujuan harus semester berikutnya, belum aktif, dan mulai setelah hari ini WIB (maksimal 366 hari). Sumber/tujuan tidak boleh diarsipkan atau bertumpang tindih.",
  TARGET_NOT_EMPTY:
    "Semester tujuan sudah berisi konfigurasi atau kegiatan. Gunakan tujuan kosong; tidak ada data yang akan ditimpa.",
  SCHOOL_INVALID: "Lengkapi profil madrasah aktif terlebih dahulu.",
  CLASS_POLICY_CHANGED:
    "Tingkat atau paralel kelas sumber tidak cocok dengan pengaturan madrasah saat ini.",
  NO_CLASSES: "Tidak ada kelas aktif pada sumber.",
  NO_SCHEDULES:
    "Tidak ada jadwal aktif yang berlaku pada hari terakhir semester sumber.",
  CLASS_MISSING: "Ada jadwal dengan kelas sumber yang telah diarsipkan.",
  INACTIVE_DEPENDENCY: "Ada guru atau mata pelajaran yang tidak aktif.",
  JP_POLICY_CHANGED:
    "Menit per JP berubah. Susun ulang jadwal melalui halaman Jadwal Mengajar.",
  WEEKDAY_MISSING: "Rentang semester tujuan tidak mencakup hari jadwal.",
  SCHEDULE_COLLISION: "Ada bentrok guru atau kelas pada hari/jam yang sama.",
  PLAN_TOO_LARGE:
    "Rencana melebihi batas 500 kelas atau 2.000 jadwal. Hubungi pengelola.",
};

/** A successful-looking acknowledgement must describe the exact reviewed ID mapping. */
export function readPreparationReceipt(
  preview: PreparationPreview,
  input: unknown,
): PreparationReceipt {
  const r = receiptSchema.parse(input),
    p = preview.plan;
  if (
    p.issues.length>0 ||
    r.previewId.toLowerCase() !== preview.previewId.toLowerCase() ||
    r.sourceId.toLowerCase() !== p.sourceId?.toLowerCase() ||
    r.targetId.toLowerCase() !== p.targetId?.toLowerCase() ||
    mappingKey(r.classMapping) !== mappingKey(p.classes) ||
    mappingKey(r.scheduleMapping) !== mappingKey(p.schedules)
  )
    throw new Error(
      "Hasil belum cocok dengan pratinjau yang diperiksa. Periksa hasil sebelum mencoba lagi.",
    );
  return r;
}

function clock(value:string) {const [h,m,s="0"]=value.split(":");return Number(h)*3600+Number(m)*60+Number(s);}
/** Compare every reviewed field, ignore JSON key/row order and UUID letter case only. */
function mappingKey(rows: object[]) {
  return rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,typeof value==="string"&&(key==="id"||key.endsWith("Id"))?value.toLowerCase():value])))).sort().join("|");
}
function planKey(plan:PreparationPreview["plan"]) {
  return JSON.stringify({...plan,sourceId:plan.sourceId?.toLowerCase(),targetId:plan.targetId?.toLowerCase(),classes:mappingKey(plan.classes),schedules:mappingKey(plan.schedules),issues:[...plan.issues].sort()});
}
export function readPreparationPreview(request:z.infer<typeof preparationRequest>,raw:unknown) {
  const value=previewSchema.parse(raw);
  if(value.result || value.plan.sourceId?.toLowerCase()!==request.sourceId.toLowerCase() || value.plan.targetId?.toLowerCase()!==request.targetId.toLowerCase() || value.plan.configuration!==request.configuration)
    throw Error("Pratinjau tidak sesuai semester atau konfigurasi yang dipilih. Muat ulang pilihan lalu periksa kembali.");
  return value;
}
export function readPreparationStatus(expected:PreparationPreview,raw:unknown) {
  const value=previewSchema.parse(raw);
  if((expected.result && !value.result) || value.previewId.toLowerCase()!==expected.previewId.toLowerCase() || Date.parse(value.expiresAt)!==Date.parse(expected.expiresAt) || planKey(value.plan)!==planKey(expected.plan))
    throw Error("Status tidak sesuai pratinjau yang telah ditinjau. Penerapan dikunci; periksa kembali hasil pratinjau yang sama.");
  if(value.result)readPreparationReceipt(expected,value.result);
  return value;
}
