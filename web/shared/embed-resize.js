(function () {
  if (window.top === window.self) return;

  const messageType = "grow-albania-calendar:height";
  let targetOrigin = "*";
  let lastHeight = 0;

  try {
    if (document.referrer) {
      targetOrigin = new URL(document.referrer).origin;
    }
  } catch {
    targetOrigin = "*";
  }

  document.documentElement.style.overflowX = "hidden";
  document.documentElement.style.overflowY = "hidden";
  document.body.style.overflowX = "hidden";
  document.body.style.overflowY = "hidden";
  document.documentElement.style.height = "auto";
  document.body.style.height = "auto";

  function activeContentRoot() {
    const appRoots = Array.from(document.querySelectorAll(".app"));
    return appRoots.find((node) => !node.classList.contains("hidden")) || appRoots[0] || document.body;
  }

  function measureHeight() {
    const root = activeContentRoot();
    return Math.max(root?.scrollHeight || 0, root?.offsetHeight || 0);
  }

  function publishHeight() {
    const height = measureHeight();
    if (Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    window.parent.postMessage(
      {
        type: messageType,
        height,
        path: window.location.pathname
      },
      targetOrigin
    );
  }

  let rafId = 0;
  function scheduleHeightPublish() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      publishHeight();
    });
  }

  function bindImageListeners(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("img").forEach((img) => {
      if (img.dataset.embedResizeBound === "1") return;
      img.dataset.embedResizeBound = "1";
      if (!img.complete) {
        img.addEventListener("load", scheduleHeightPublish, { once: true });
        img.addEventListener("error", scheduleHeightPublish, { once: true });
      }
    });
  }

  window.addEventListener("load", scheduleHeightPublish);
  window.addEventListener("resize", scheduleHeightPublish);
  window.addEventListener("orientationchange", scheduleHeightPublish);
  document.addEventListener("DOMContentLoaded", scheduleHeightPublish);
  bindImageListeners(document);

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleHeightPublish).catch(() => {});
  }

  let resizeObserver = null;
  function connectResizeObserver() {
    if (!("ResizeObserver" in window)) return;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(scheduleHeightPublish);
    resizeObserver.observe(activeContentRoot());
  }

  connectResizeObserver();

  if ("MutationObserver" in window) {
    const observer = new MutationObserver((mutations) => {
      connectResizeObserver();
      scheduleHeightPublish();
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) bindImageListeners(node);
        });
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    scheduleHeightPublish();
    attempts += 1;
    if (attempts >= 24) window.clearInterval(timer);
  }, 500);
})();
