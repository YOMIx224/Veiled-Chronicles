// =============================================================
//  dialogs.js — DialogV2 that closes instantly
// =============================================================
// Foundry closes a window by animating max-height to 0 and waiting for the CSS
// transition to end, with a 1 second fallback. The RnR dialog theme pins
// max-height, so the transition never ran and every dialog took a full second
// to disappear after a button was pressed. RnR dialogs skip that animation.
//
// The static helpers (wait, confirm, prompt) construct `new this(...)`, so
// `RnRDialogV2.confirm(...)` also closes instantly.

const BaseDialogV2 = globalThis.foundry?.applications?.api?.DialogV2;

export const RnRDialogV2 = BaseDialogV2
  ? class RnRDialogV2 extends BaseDialogV2 {
    close(options = {}) {
      return super.close({ animate: false, ...options });
    }
  }
  : null;
