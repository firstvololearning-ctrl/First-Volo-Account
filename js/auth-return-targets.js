(function () {
  "use strict";
  const targets = Object.freeze({ storyBuilder: "https://firstvololearning-ctrl.github.io/First-Volo-Story-Builder/", morphology: "https://firstvololearning-ctrl.github.io/First-Volo-Morphology/", primoVolo: "https://firstvololearning-ctrl.github.io/Primo-Volo-Italian-Learning-Hub/" });
  const localHarness = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const detailedProgressTargets = Object.freeze({ morphology: localHarness ? `${window.location.origin}/morphology/program-progress.html` : `${targets.morphology}program-progress.html` });
  function requestedKey() { const key = new URLSearchParams(window.location.search).get("returnTo"); return Object.prototype.hasOwnProperty.call(targets, key) ? key : null; }
  function destinationFor(key) { return targets[key] || null; }
  function detailedProgressFor(key) { return detailedProgressTargets[key] || null; }
  window.FirstVoloAccountReturnTargets = { requestedKey, destinationFor, detailedProgressFor };
}());
