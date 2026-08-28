(() => {
  let allowExit = false;
  let restoringHistory = false;

  function shouldConfirm() {
    return !allowExit;
  }

  function confirmExit() {
    if (!shouldConfirm()) return true;
    return window.confirm("Do you want to exit this page?");
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
    if (!confirmExit()) {
      event.preventDefault();
      return;
    }
    allowExit = true;
  }, true);

  history.pushState({ exitGuard: true }, "", window.location.href);
  window.addEventListener("popstate", () => {
    if (restoringHistory) return;
    if (confirmExit()) {
      allowExit = true;
      history.back();
      return;
    }
    restoringHistory = true;
    history.pushState({ exitGuard: true }, "", window.location.href);
    restoringHistory = false;
  });

  window.addEventListener("beforeunload", event => {
    if (!shouldConfirm()) return;
    event.preventDefault();
    event.returnValue = "Do you want to exit this page?";
  });
})();
