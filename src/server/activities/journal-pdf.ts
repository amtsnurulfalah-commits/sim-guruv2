/** Paginated landscape register. Long cells continue without clipping other columns. */
export function writeJournalRegister(
  doc: PDFKit.PDFDocument,
  rows: Record<string, unknown>[],
  range: string,
) {
  const widths = [27, 66, 43, 66, 170, 100, 100, 113, 84];
  const labels = [
    "No.",
    "Hari / tanggal",
    "Kelas",
    "Waktu / JTM",
    "Materi / tujuan pembelajaran",
    "Kendala",
    "Tindak lanjut",
    "Refleksi guru",
    "Pengesahan pengiriman",
  ];
  const left = 36,
    bottom = () => doc.page.height - 36;
  let y = 0,
    group = "",
    number = 0;
  function header(title: string) {
    doc
      .fontSize(15)
      .fillColor("#12344b")
      .text("JURNAL MENGAJAR GURU", left, 30);
    doc.fontSize(9).fillColor("#222222").text(title, left, 52, { width: 760 });
    doc.text(
      "SiM-Guru · " + range + " · Tanggal operasional Asia/Jakarta",
      left,
      doc.y + 5,
      { width: 760 },
    );
    y = doc.y + 12;
    let x = left;
    labels.forEach((label, i) => {
      doc.rect(x, y, widths[i]!, 36).fillAndStroke("#12344b", "#ced9e1");
      doc
        .fillColor("white")
        .fontSize(8)
        .text(label, x + 4, y + 5, { width: widths[i]! - 8, height: 29 });
      x += widths[i]!;
    });
    y += 36;
    doc.fillColor("#222222").fontSize(8);
  }
  function fit(text: string, width: number, maxHeight: number) {
    if (doc.heightOfString(text, { width }) <= maxHeight) return text.length;
    let lo = 0,
      hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (doc.heightOfString(text.slice(0, mid), { width }) <= maxHeight)
        lo = mid;
      else hi = mid - 1;
    }
    // Never split a UTF-16 surrogate pair across pages.
    if (lo > 0 && /[\uD800-\uDBFF]/.test(text[lo - 1]!)) lo--;
    return lo;
  }
  if (!rows.length) {
    header("Tidak ada jurnal pada rentang ini.");
    return;
  }
  const ordered = [...rows].sort((a, b) =>
    [
      a.userId,
      a.subjectName,
      String(a.date).slice(0, 7),
      a.date,
      a.timeStart,
      a.id,
    ]
      .join("|")
      .localeCompare(
        [
          b.userId,
          b.subjectName,
          String(b.date).slice(0, 7),
          b.date,
          b.timeStart,
          b.id,
        ].join("|"),
      ),
  );
  for (const row of ordered) {
    const key = [
      row.userId,
      row.subjectName,
      String(row.date).slice(0, 7),
      row.periodLabel,
    ].join("|");
    const title = `${row.schoolName || "Sekolah belum diatur"} (identitas saat ekspor) · ${row.teacherName} · ${row.subjectName} · ${row.periodLabel || "Periode belum dicatat"} · ${String(row.date).slice(0, 7)}`;
    if (key !== group) {
      if (group) doc.addPage();
      group = key;
      number = 0;
      header(title);
    }
    const value = (key: string) => String(row[key] || "Belum dicatat");
    const date = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(String(row.date) + "T00:00:00+07:00"));
    const sent = row.submittedAt
      ? new Intl.DateTimeFormat("id-ID", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "Asia/Jakarta",
        }).format(new Date(String(row.submittedAt))) + " WIB"
      : "Belum dicatat";
    let cells = [
      String(++number),
      date,
      value("className"),
      `${row.timeStart || "—"}–${row.timeEnd || "—"}\n${value("creditedJtm")} JTM\n${row.inputType === "H_MINUS_1" ? "H-1 (80%)" : "Hari H (100%)"}`,
      `${value("material")}\n\nTP: ${value("learningObjectives")}\n\nHadir: ${row.present}; absen: ${row.absent}\nCatatan: ${value("notes")}`,
      value("obstacles"),
      value("followUp"),
      value("reflection"),
      `${row.teacherName}\n${sent}\nIdentitas pengiriman; bukan paraf gambar.`,
    ];
    while (cells.some(Boolean)) {
      if (bottom() - y < 40) {
        doc.addPage();
        header(title + " · lanjutan");
      }
      const room = bottom() - y - 10;
      const chunks = cells.map((text, i) =>
        text.slice(0, fit(text, widths[i]! - 8, room)),
      );
      const height = Math.max(
        24,
        ...chunks.map(
          (text, i) => doc.heightOfString(text, { width: widths[i]! - 8 }) + 10,
        ),
      );
      let x = left;
      chunks.forEach((text, i) => {
        doc
          .rect(x, y, widths[i]!, height)
          .fillAndStroke(number % 2 ? "#f2f7fa" : "#ffffff", "#ced9e1");
        doc
          .fillColor("#222222")
          .text(text, x + 4, y + 5, {
            width: widths[i]! - 8,
            height: height - 8,
          });
        x += widths[i]!;
      });
      cells = cells.map((text, i) => text.slice(chunks[i]!.length));
      y += height;
    }
  }
}
