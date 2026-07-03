// js/services/toastService.js

const toastService = (() => {
  let container = null;

  function ensureContainer() {
    if (container) return container;

    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);

    injectStyles();

    return container;
  }

  function injectStyles() {
    if (document.getElementById("toast-service-styles")) return;

    const style = document.createElement("style");
    style.id = "toast-service-styles";

    style.textContent = `
      .toast-container {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 360px;
      }

      .toast {
        padding: 14px 16px;
        border-radius: 12px;
        color: #ffffff;
        font-weight: 700;
        box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        animation: toast-slide-in 0.2s ease-out;
        line-height: 1.35;
      }

      .toast.success {
        background: #1f883d;
      }

      .toast.error {
        background: #d1242f;
      }

      .toast.info {
        background: #0969da;
      }

      .toast.warning {
        background: #9a6700;
      }

      @keyframes toast-slide-in {
        from {
          opacity: 0;
          transform: translateX(20px);
        }

        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @media (max-width: 600px) {
        .toast-container {
          top: 12px;
          right: 12px;
          left: 12px;
          max-width: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function show(message, type = "info", duration = 3200) {
    if (!message) return;

    const container = ensureContainer();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      toast.style.transition = "all 0.2s ease-out";

      setTimeout(() => {
        toast.remove();
      }, 220);
    }, duration);
  }

  function success(message) {
    show(message, "success");
  }

  function error(message) {
    show(message, "error");
  }

  function info(message) {
    show(message, "info");
  }

  function warning(message) {
    show(message, "warning");
  }

  return {
    show,
    success,
    error,
    info,
    warning
  };
})();