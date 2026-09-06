(function () {
  "use strict";
  const content = document.getElementById("resetContent");
  function show(message, error = false) {
    content.innerHTML = `<section class="card ${error ? "error" : ""}"><p>${message}</p><a class="button button-secondary" href="index.html">Return to My First Volo</a></section>`;
  }
  function showSuccess() {
    content.innerHTML = '<section class="card"><div class="account-heading"><h2>Password updated</h2><p>Your new password is ready. Continue to sign in with it.</p></div><button id="resetSignIn" class="button button-primary" type="button">Go to sign in</button><p id="resetSignInStatus" class="form-message" role="status" aria-live="polite"></p></section>';
    const button = document.getElementById("resetSignIn");
    button.addEventListener("click", async () => {
      button.disabled = true;
      const status = document.getElementById("resetSignInStatus");
      status.textContent = "Opening sign in…";
      try {
        // A recovery link creates a session; end it before opening sign-in.
        const result = await window.FirstVoloAccountAuth.signOut();
        if (result?.error) throw result.error;
        window.location.replace("index.html");
      } catch (error) {
        button.disabled = false;
        status.textContent = "Your password was updated, but sign-in could not be opened. Please try again.";
      }
    });
  }
  async function init() {
    try {
      const user = await window.FirstVoloAccountAuth.ready();
      if (!user) { show("This password-reset link is no longer valid. Return to My First Volo and request a new one.", true); return; }
      content.innerHTML = '<section class="card"><div class="account-heading"><h2>Set a new password</h2><p>Choose a password for your First Volo account.</p></div><form id="resetForm" class="sign-in-form"><label for="newPassword">New password</label><input id="newPassword" type="password" autocomplete="new-password" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" autocomplete="new-password" required><button class="button button-primary" type="submit">Save new password</button><p id="resetStatus" class="form-message" role="status" aria-live="polite"></p></form></section>';
      document.getElementById("resetForm").addEventListener("submit", async event => {
        event.preventDefault();
        const first = document.getElementById("newPassword");
        const second = document.getElementById("confirmPassword");
        const status = document.getElementById("resetStatus");
        if (first.value !== second.value) { status.textContent = "Passwords do not match."; return; }
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const result = await window.FirstVoloAccountAuth.updatePassword(first.value);
          if (result.error) throw result.error;
          first.value = "";
          second.value = "";
          showSuccess();
        } catch (error) {
          first.value = "";
          second.value = "";
          if (await window.FirstVoloAccountAuth.handleSessionError(error)) { show("Your sign-in session has expired. Please sign in again.", true); return; }
          status.textContent = "The password could not be saved. Please try again.";
        } finally {
          button.disabled = false;
        }
      });
    } catch (error) { show("This password-reset session could not be verified. Please request a new link.", true); }
  }
  init();
}());
