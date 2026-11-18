/// <reference types="vite-plugin-pwa/client" />

const previewHostPatterns = [
  /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/,
  /^project--[a-z0-9-]+-dev\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/,
];

const previewSuffixes = [
  ".lovableproject.com",
  ".lovableproject-dev.com",
  ".beta.lovable.dev",
];
const delegatedPreviewHost = "id-preview--2e46ba88-a05f-4a5d-bead-c139f2e8c0b2.lovable.app";

function shouldRegisterServiceWorker() {
  if (!import.meta.env.PROD || typeof window === "undefined") return false;

  const hostname = window.location.hostname.toLowerCase();
  const isSpecialHost =
    hostname === "lovableproject.com" ||
    hostname === "lovableproject-dev.com" ||
    hostname === "beta.lovable.dev" ||
    previewSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    previewHostPatterns.some((pattern) => pattern.test(hostname));
  const isDelegatedMainPreview = hostname === delegatedPreviewHost;

  return (
    window.self === window.top &&
    !isSpecialHost &&
    !isDelegatedMainPreview &&
    new URLSearchParams(window.location.search).get("sw") !== "off"
  );
}

async function unregisterMindCareWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
      .map((registration) => registration.unregister()),
  );
}

export async function registerMindCareOffline() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (!shouldRegisterServiceWorker()) {
    await unregisterMindCareWorkers();
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}