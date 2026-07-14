// js/services/reportExportService.js

const reportExportService = (() => {
  function escapeCsvValue(value) {
    const text = String(value ?? "");

    if (
      text.includes(",") ||
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r")
    ) {
      return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  }

  function buildCsv(headers, rows) {
    return [
      headers.map(escapeCsvValue).join(","),
      ...rows.map(row =>
        row.map(escapeCsvValue).join(",")
      )
    ].join("\n");
  }

  function createExport(
    filename,
    headers,
    rows
  ) {
    return {
      filename,
      mimeType: "text/csv;charset=utf-8",
      content: buildCsv(headers, rows),
      rowCount: rows.length
    };
  }

  function getAssignmentExport(filters = {}) {
    const rows =
      reportingService.getAssignmentDetails(
        filters
      );

    return createExport(
      "bluecrew-assignment-report.csv",
      [
        "Date",
        "Time",
        "Matchup",
        "Field",
        "Level",
        "Status",
        "Assignments",
        "Assigned",
        "Open Assignments",
        "Pending Claims"
      ],
      rows.map(row => [
        row.date,
        row.time,
        row.matchup,
        row.field,
        row.level,
        row.status,
        row.assignmentCount,
        row.assignedCount,
        row.openAssignments,
        row.pendingClaims
      ])
    );
  }

  function getAvailabilityExport(filters = {}) {
    const rows =
      reportingService.getAvailabilityDetails(
        filters
      );

    return createExport(
      "bluecrew-availability-report.csv",
      [
        "Date",
        "Crew Member",
        "Status"
      ],
      rows.map(row => [
        row.date,
        row.crewName,
        row.status
      ])
    );
  }

  function getReviewExport(filters = {}) {
    const rows =
      reportingService.getReviewDetails(
        filters
      );

    return createExport(
      "bluecrew-review-report.csv",
      [
        "Date",
        "Matchup",
        "Field",
        "Level",
        "Status",
        "Submitted At",
        "Reviewed At"
      ],
      rows.map(row => [
        row.date,
        row.matchup,
        row.field,
        row.level,
        row.statusLabel,
        row.submittedAt,
        row.reviewedAt
      ])
    );
  }

  function download(exportFile) {
    if (
      !exportFile ||
      typeof exportFile.content !== "string"
    ) {
      return false;
    }

    const blob = new Blob(
      [exportFile.content],
      {
        type:
          exportFile.mimeType ||
          "text/csv;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      exportFile.filename ||
      "bluecrew-report.csv";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    return true;
  }

  return {
    buildCsv,
    getAssignmentExport,
    getAvailabilityExport,
    getReviewExport,
    download
  };
})();
