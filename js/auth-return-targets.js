(function () {
  "use strict";
  const targets = Object.freeze({ storyBuilder: "https://firstvololearning-ctrl.github.io/First-Volo-Story-Builder/", morphology: "http://127.0.0.1:8767/index.html", primoVolo: null });
  function requestedKey() { const key = new URLSearchParams(window.location.search).get("returnTo"); return Object.prototype.hasOwnProperty.call(targets, key) ? key : null; }
  function destinationFor(key) { return targets[key] || null; }
  window.FirstVoloAccountReturnTargets = { requestedKey, destinationFor };
}());
