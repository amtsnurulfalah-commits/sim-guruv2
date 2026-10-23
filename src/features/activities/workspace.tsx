"use client";
import { JournalWorkspace } from "./journal-workspace";
import { ConfirmationWorkspace } from "./confirmation-workspace";
import { StudentWorkspace } from "./student-workspace";
import { AttendanceWorkspace } from "./attendance-workspace";
export function ActivityWorkspace(props: {
  admin: boolean;
  userId: string;
  mode: "occurrences" | "attendance" | "students" | "journals";
  studentView?: "input" | "history";
}) {
  if (props.mode === "occurrences")
    return <ConfirmationWorkspace admin={props.admin} userId={props.userId} />;
  if (props.mode === "students")
    return (
      <StudentWorkspace
        admin={props.admin}
        userId={props.userId}
        initialView={props.studentView ?? "input"}
      />
    );
  if (props.mode === "journals")
    return <JournalWorkspace admin={props.admin} userId={props.userId} />;
  return <AttendanceWorkspace admin={props.admin} userId={props.userId} />;
}
