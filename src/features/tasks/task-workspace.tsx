"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useWibDay } from "@/lib/calendar/use-wib-day";
import { TaskCenter } from "./task-center";

export function TaskWorkspace({initialDate, accountId}: {initialDate: string; accountId: string}) {
  const date = useWibDay(initialDate);
  const dateLabel = new Intl.DateTimeFormat("id-ID", {dateStyle: "full", timeZone: "Asia/Jakarta"}).format(new Date(date + "T12:00:00Z"));
  return <div className="ui-workspace-pilot min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <PageHeader title="Pusat tugas" context={dateLabel + " · WIB"}
      description="Prioritaskan tugas, periksa prasyarat, lalu selesaikan pekerjaan di halaman sumber."
      actions={<Button asChild variant="outline"><Link prefetch={false} href="/notifikasi"><Bell aria-hidden="true"/>Lihat notifikasi</Link></Button>}/>
    <TaskCenter key={accountId + date} date={date}/>
  </div>;
}
