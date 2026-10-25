"use client";
import Link from "next/link";
import { Bell, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWibDay } from "@/lib/calendar/use-wib-day";
import { TaskCenter } from "./task-center";

export function TaskWorkspace({initialDate, accountId}: {initialDate: string; accountId: string}) {
  const date = useWibDay(initialDate);
  const dateLabel = new Intl.DateTimeFormat("id-ID", {dateStyle: "full", timeZone: "Asia/Jakarta"}).format(new Date(date + "T12:00:00Z"));
  return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <header className="space-y-3 rounded-2xl border bg-accent/40 p-4 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><ListChecks aria-hidden="true" className="size-4 shrink-0"/>{dateLabel} · WIB</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pusat tugas</h1>
      <p className="max-w-3xl text-sm leading-7 text-muted-foreground">Prioritaskan tugas dan periksa prasyaratnya. Selesaikan pekerjaan di halaman sumber.</p>
      <Button asChild variant="outline"><Link prefetch={false} href="/notifikasi"><Bell aria-hidden="true"/>Lihat notifikasi</Link></Button>
    </header>
    <TaskCenter key={accountId + date} date={date}/>
  </div>;
}
