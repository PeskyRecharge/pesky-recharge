/**
 * Pesky Recharge - Dedicated PWA Installation & Device Guide Controller
 * Handles native beforeinstallprompt, iOS Safari guidance, and standalone detection.
 */

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("installAppBtn");
  const installBtnText = document.getElementById("installBtnText");
  const installStatusMsg = document.getElementById("installStatusMsg");
  const osTabs = document.querySelectorAll(".os-tab");
  const guidePanels = document.querySelectorAll(".guide-panel");
  const fallbackModal = document.getElementById("fallbackModal");
  const modalInstructions = document.getElementById("modalInstructions");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalGotItBtn = document.getElementById("modalGotItBtn");
  const yearSpan = document.getElementById("currentYear");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Platform detection
  const ua = window.navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  let deferredInstallPrompt = null;

  // Helper: Switch OS Instruction Tab
  function activateOsTab(targetId) {
    osTabs.forEach((tab) => {
      const isMatch = tab.dataset.target === targetId;
      tab.classList.toggle("active", isMatch);
      tab.setAttribute("aria-selected", String(isMatch));
    });

    guidePanels.forEach((panel) => {
      const isMatch = panel.id === targetId;
      panel.classList.toggle("active", isMatch);
      panel.hidden = !isMatch;
    });
  }

  // Auto-select iPhone tab for iOS visitors
  if (isIOS) {
    activateOsTab("iphone-guide");
    if (installStatusMsg) {
      installStatusMsg.textContent =
        "iPhone detected: Tap Install below for quick Safari setup.";
    }
  }

  // If already running inside the installed PWA
  if (isStandalone && installBtn && installBtnText) {
    installBtn.classList.add("installed");
    installBtnText.textContent = "PeskyRecharge is Installed";
    if (installStatusMsg) {
      installStatusMsg.textContent =
        "You are currently using the installed PeskyRecharge app.";
    }
  }

  // Capture Android/Desktop Chrome native install prompt
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;

    if (installBtnText) {
      installBtnText.textContent = "Install PeskyRecharge Now";
    }
    if (installStatusMsg) {
      installStatusMsg.textContent =
        "Ready for one-tap installation on your device.";
    }
  });

  // Listen for successful installation
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installBtn && installBtnText) {
      installBtn.classList.add("installed");
      installBtnText.textContent = "Installed Successfully";
    }
    if (installStatusMsg) {
      installStatusMsg.textContent =
        "PeskyRecharge has been added to your home screen!";
    }
  });

  // Handle Install Button Click
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (isStandalone) {
        window.location.href = "index.html";
        return;
      }

      // 1. Trigger native PWA prompt if available (Chrome / Edge / Android)
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === "accepted") {
          deferredInstallPrompt = null;
        }
        return;
      }

      // 2. Fallback modal with tailored OS instructions (iOS Safari or browsers without prompt)
      if (isIOS) {
        activateOsTab("iphone-guide");
        modalInstructions.innerHTML =
          'On your iPhone, tap the <strong>Share icon (↑)</strong> at the bottom of Safari, scroll down, and tap <strong>"Add to Home Screen"</strong>.';
      } else {
        activateOsTab("android-guide");
        modalInstructions.innerHTML =
          'Tap the <strong>three dots (⋮)</strong> in the top-right corner of your browser and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.';
      }

      if (fallbackModal) {
        fallbackModal.hidden = false;
      }
    });
  }

  // OS Tab Click Events
  osTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateOsTab(tab.dataset.target);
    });
  });

  // Modal Close Controls
  function closeModal() {
    if (fallbackModal) {
      fallbackModal.hidden = true;
    }
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (modalGotItBtn) modalGotItBtn.addEventListener("click", closeModal);
  if (fallbackModal) {
    fallbackModal.addEventListener("click", (e) => {
      if (e.target === fallbackModal) closeModal();
    });
  }
});