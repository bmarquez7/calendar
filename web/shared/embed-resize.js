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

  function measureHeight() {
    const body = document.body;
    const doc = document.documentElement;
    return Math.max(
      body?.scrollHeight || 0,
      body?.offsetHeight || 0,
      doc?.clientHeight || 0,
      doc?.scrollHeight || 0,
      doc?.offsetHeight || 0
    );
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

  window.addEventListener("load", scheduleHeightPublish);
  window.addEventListener("resize", scheduleHeightPublish);
  document.addEventListener("DOMContentLoaded", scheduleHeightPublish);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleHeightPublish);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    scheduleHeightPublish();
    attempts += 1;
    if (attempts >= 24) window.clearInterval(timer);
  }, 500);
})();
