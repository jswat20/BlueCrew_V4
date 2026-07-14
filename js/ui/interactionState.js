// js/ui/interactionState.js

/*
  Shared synchronous mutation protection.

  This does not introduce asynchronous infrastructure.
  It prevents repeated activation while an existing
  synchronous command is executing and exposes a
  consistent busy state to assistive technology.
*/

function runSynchronousButtonAction(
  control,
  action
) {
  if (
    !control ||
    typeof action !== "function"
  ) {
    return;
  }

  if (
    control.disabled ||
    control.getAttribute("aria-busy") ===
      "true"
  ) {
    return;
  }

  control.disabled = true;
  control.setAttribute(
    "aria-busy",
    "true"
  );

  try {
    return action();
  } finally {
    /*
      The action may rerender the page and detach the
      original element. Restoring the detached control
      is harmless and keeps non-rerendering actions
      usable.
    */
    control.removeAttribute("aria-busy");
    control.disabled = false;
  }
}

window.runSynchronousButtonAction =
  runSynchronousButtonAction;
