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
    "Waktu",
    "Materi / tujuan pembelajaran",
    "Kendala",
    "Tindak lanjut",
    "Refleksi guru",
    "Guru / tanggal pengisian",
  ];
  const left = 36,
    bottom = () => doc.page.height - 36;
  let y = 0,
    group = "",
    number = 0;
  function header(row: Record<string, unknown>, continued = false) {
    doc.fillColor("#12344b").fontSize(18);
    if (row.schoolName) doc.text(String(row.schoolName).toLocaleUpperCase("id-ID"), left, 30, { width: 769, align: "center" });
    else doc.text("JURNAL PEMBELAJARAN", left, 30, { width: 769, align: "center" });
    const line = doc.y + 10;
    doc.moveTo(left, line).lineTo(left + 769, line).lineWidth(1.5).stroke("#12344b");
    doc.moveTo(left, line + 3).lineTo(left + 769, line + 3).lineWidth(0.5).stroke("#12344b");
    doc.fontSize(12).text("JURNAL MENGAJAR GURU" + (continued ? " — LANJUTAN" : ""), left, line + 14, { width: 769, align: "center" });
    const metaTop = doc.y + 12;
    doc.fontSize(9).fillColor("#222222");
    doc.text("Nama guru: " + String(row.teacherName || "—"), left, metaTop, { width: 375 });
    doc.text("Mata pelajaran: " + String(row.subjectName || "—"), left, doc.y + 4, { width: 375 });
    const leftBottom = doc.y;
    doc.text("Tahun pelajaran / semester: " + String(row.periodLabel || "—"), left + 394, metaTop, { width: 375 });
    const month = row.date ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(String(row.date) + "T00:00:00+07:00")) : range;
    doc.text("Periode: " + month, left + 394, doc.y + 4, { width: 375 });
    y = Math.max(leftBottom, doc.y) + 14;
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
    header({});
    doc.text("Tidak ada jurnal pada periode yang dipilih.", left, y + 12);
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
    if (key !== group) {
      if (group) doc.addPage();
      group = key;
      number = 0;
      header(row);
    }
    const value = (key: string) => String(row[key] || "—");
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
      : "—";
    let cells = [
      String(++number),
      date,
      value("className"),
      `${row.timeStart || "—"}–${row.timeEnd || "—"}`,
      `${value("material")}\n\nTP: ${value("learningObjectives")}\n\nHadir: ${row.present}; absen: ${row.absent}\nCatatan: ${value("notes")}`,
      value("obstacles"),
      value("followUp"),
      value("reflection"),
      `${row.teacherName}\n${sent}`,
    ];
    while (cells.some(Boolean)) {
      if (bottom() - y < 40) {
        doc.addPage();
        header(row, true);
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
