(function () {
  "use strict";
  const content = document.getElementById("resetContent");
  function show(message, error = false) { content.innerHTML = `<section class="card ${error ? "error" : ""}"><p>${message}</p></section>`; }
  async function init() {
    try {
      const user = await window.FirstVoloAccountAuth.ready();
      if (!user) { show("This password-reset link is no longer valid. Return to My First Volo and request a new one.", true); return; }
      content.innerHTML = '<section class="card"><div class="account-heading"><h2>Set a new password</h2><p>Choose a password for your First Volo account.</p></div><form id="resetForm" class="sign-in-form"><label for="newPassword">New password</label><input id="newPassword" type="password" autocomplete="new-password" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" autocomplete="new-password" required><button class="button button-primary" type="submit">Save new password</button><p id="resetStatus" class="form-message" role="status" aria-live="polite"></p></form></section>';
      document.getElementById("resetForm").addEventListener("submit", async event => {
        event.preventDefault();
        const first = document.getElementById("newPassword"); const second = document.getElementById("confirmPassword"); const status = document.getElementById("resetStatus");
        if (first.value !== second.value) { status.textContent = "Passwords do not match."; return; }
        try { const result = await window.FirstVoloAccountAuth.updatePassword(first.value); if (result.error) throw result.error; status.textContent = "Password saved. You can use it the next time you sign in."; first.value = ""; second.value = ""; } catch (error) { if (await window.FirstVoloAccountAuth.handleSessionError(error)) { show("Your sign-in session has expired. Please sign in again.", true); return; } status.textContent = "The password could not be saved. Please try again."; first.value = ""; second.value = ""; }
      });
    } catch (error) { show("This password-reset session could not be verified. Please request a new link.", true); }
  }
  init();
}());
