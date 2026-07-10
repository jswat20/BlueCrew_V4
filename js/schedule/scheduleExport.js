// js/schedule/scheduleExport.js

function exportSchedule() {
  const games =
    gameService.getAll();

  if (!games.length) {
    toastService.info(
      "There are no games to export."
    );

    updateScheduleExportButton();
    return;
  }

  const exportResult =
    scheduleExportService.createExport(games);

  downloadScheduleCsv(
    exportResult.csv,
    exportResult.filename
  );

  toastService.success(
    `Exported ${exportResult.count} ${
      exportResult.count === 1
        ? "game"
        : "games"
    }.`
  );
}

function downloadScheduleCsv(csv, filename) {
  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function updateScheduleExportButton() {
  const exportButton =
    document.querySelector(
      '[data-testid="export-schedule"]'
    );

  if (!exportButton) return;

  exportButton.disabled =
    gameService.getAll().length === 0;
}