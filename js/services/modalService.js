// js/services/modalService.js

const modalService = (() => {

  let activeModal = null;

  function injectStyles() {
    if (document.getElementById("modal-service-styles")) return;

    const style = document.createElement("style");
    style.id = "modal-service-styles";

    style.textContent = `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15,23,42,.45);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;

        opacity: 0;
        animation: modalFade .18s ease forwards;
      }

      .modal-dialog {
        width: min(92vw, 420px);
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0,0,0,.22);
        overflow: hidden;

        transform: scale(.96);
        animation: modalPop .18s ease forwards;
      }

      .modal-dialog.danger {
        border-top: 5px solid #dc2626;
      }

      .modal-header {
        padding: 20px 22px 10px;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 22px;
        color: #0f172a;
      }

      .modal-body {
        padding: 0 22px 22px;
        color: #475569;
        line-height: 1.5;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 18px 22px;
        background: #f8fafc;
      }

      .modal-actions button {
        border: none;
        border-radius: 10px;
        padding: 10px 18px;
        font-weight: 700;
        cursor: pointer;
      }

      .modal-cancel {
        background: #e2e8f0;
        color: #0f172a;
      }

      .modal-confirm {
        background: #2563eb;
        color: white;
      }

      .modal-confirm.danger {
        background: #dc2626;
      }

      @keyframes modalFade {
        to { opacity: 1; }
      }

      @keyframes modalPop {
        to {
          transform: scale(1);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function close(result) {

    if (!activeModal) return;

    document.removeEventListener("keydown", handleKey);

    activeModal.remove();
    activeModal = null;

    if (resolver) {
      resolver(result);
      resolver = null;
    }
  }

  let resolver = null;

  function handleKey(e) {

    if (e.key === "Escape") {
      close(false);
    }

    if (e.key === "Enter") {
      close(true);
    }
  }

  async function confirm(options = {}) {

    injectStyles();

    if (activeModal) {
      activeModal.remove();
    }

    return new Promise(resolve => {

      resolver = resolve;

      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";

      overlay.innerHTML = `
        <div class="modal-dialog ${options.danger ? "danger" : ""}">

          <div class="modal-header">
            <h2>${options.title || "Confirm"}</h2>
          </div>

          <div class="modal-body">
            ${options.message || ""}
          </div>

          <div class="modal-actions">

            <button
              class="modal-cancel"
              id="modal-cancel">

              ${options.cancelText || "Cancel"}

            </button>

            <button
              class="modal-confirm ${options.danger ? "danger" : ""}"
              id="modal-confirm">

              ${options.confirmText || "OK"}

            </button>

          </div>

        </div>
      `;

      activeModal = overlay;

      document.body.appendChild(overlay);

      document.addEventListener("keydown", handleKey);

      overlay
        .querySelector("#modal-cancel")
        .onclick = () => close(false);

      overlay
        .querySelector("#modal-confirm")
        .onclick = () => close(true);

      overlay.onclick = e => {
        if (e.target === overlay) {
          close(false);
        }
      };
    });
  }

  return {
    confirm
  };

})();