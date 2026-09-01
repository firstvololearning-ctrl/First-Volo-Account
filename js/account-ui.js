(function () {
  "use strict";

  const content = document.getElementById("accountContent");
  const signOutButton = document.getElementById("signOutButton");

  function escape(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function expiration(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Expiration date unavailable" : `Access through ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date)}`;
  }

  function isEmailRateLimit(error) {
    const status = Number(error?.status || error?.statusCode);
    const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
    return status === 429 || text.includes("rate limit") || text.includes("too many requests");
  }

  function showError() {
    signOutButton.hidden = true;
    content.innerHTML = '<section class="card error"><strong>Account access could not be verified.</strong><p>Please try again later.</p></section>';
  }

  function renderSignedOut(messageText = "") {
    signOutButton.hidden = true;
    const isStoryBuilder = window.FirstVoloAccountReturnTargets.requestedKey() === "storyBuilder";
    const heading = isStoryBuilder ? "Sign in to continue to Story Builder" : "Sign in to My First Volo";
    content.innerHTML = `<section class="card"><div class="account-heading"><h2>${heading}</h2><p>Use your My First Volo account to access your products.</p></div><form id="passwordSignInForm" class="sign-in-form"><label for="signInEmail">Email</label><input id="signInEmail" type="email" autocomplete="email" required><label for="signInPassword">Password</label><input id="signInPassword" type="password" autocomplete="current-password" required><button class="button button-primary" type="submit">Sign in</button><p id="passwordSignInMessage" class="form-message" role="status" aria-live="polite"></p></form><div class="secondary-auth-actions"><button id="forgotPasswordButton" class="text-button" type="button">Forgot password?</button><button id="magicLinkButton" class="text-button" type="button">Email me a sign-in link instead</button></div><form id="forgotPasswordForm" class="sign-in-form secondary-form" hidden><label for="resetEmail">Email</label><input id="resetEmail" type="email" autocomplete="email" required><button class="button button-secondary" type="submit">Send password-reset link</button><p id="resetMessage" class="form-message" role="status" aria-live="polite">If an account exists for that email, a password-reset link has been sent.</p></form><form id="magicLinkForm" class="sign-in-form secondary-form" hidden><label for="magicEmail">Email</label><input id="magicEmail" type="email" autocomplete="email" required><button class="button button-secondary" type="submit">Email me a sign-in link</button><p id="magicMessage" class="form-message" role="status" aria-live="polite"></p></form><p class="readonly-note">Your account and product access are read-only here.</p></section>`;

    const passwordForm = document.getElementById("passwordSignInForm");
    const passwordMessage = document.getElementById("passwordSignInMessage");
    if (messageText) document.getElementById("passwordSignInMessage").textContent = messageText;
    passwordForm.addEventListener("submit", async event => {
      event.preventDefault();
      passwordMessage.textContent = "Signing in…";
      try {
        const result = await window.FirstVoloAccountAuth.signInWithPassword(document.getElementById("signInEmail").value.trim(), document.getElementById("signInPassword").value);
        if (result.error) throw result.error;
      } catch (error) {
        if (await window.FirstVoloAccountAuth.handleSessionError(error)) {
          renderSignedOut("Your sign-in session has expired. Please sign in again.");
          return;
        }
        passwordMessage.textContent = "Email or password could not be verified.";
      } finally {
        document.getElementById("signInPassword").value = "";
      }
    });

    const forgotForm = document.getElementById("forgotPasswordForm");
    document.getElementById("forgotPasswordButton").addEventListener("click", () => { forgotForm.hidden = !forgotForm.hidden; });
    forgotForm.addEventListener("submit", async event => {
      event.preventDefault();
      const message = document.getElementById("resetMessage");
      try { const result = await window.FirstVoloAccountAuth.requestPasswordReset(document.getElementById("resetEmail").value.trim()); if (result.error) throw result.error; } catch (error) { /* Keep the same anti-enumeration response. */ }
      message.textContent = "If an account exists for that email, a password-reset link has been sent.";
      document.getElementById("resetEmail").value = "";
    });

    const magicForm = document.getElementById("magicLinkForm");
    document.getElementById("magicLinkButton").addEventListener("click", () => { magicForm.hidden = !magicForm.hidden; });
    magicForm.addEventListener("submit", async event => {
      event.preventDefault();
      const message = document.getElementById("magicMessage");
      try { const result = await window.FirstVoloAccountAuth.signInWithMagicLink(document.getElementById("magicEmail").value.trim()); if (result.error) throw result.error; message.textContent = "Check your email and open the First Volo sign-in link."; } catch (error) { message.textContent = isEmailRateLimit(error) ? "Too many sign-in links have been requested. Please wait a little while and try again." : "The sign-in email could not be sent. Please try again."; }
    });
  }

  function renderSecurity() {
    return '<section class="security-section"><h3>Account security</h3><p>Set or change your password for future sign-ins.</p><form id="passwordForm" class="sign-in-form"><label for="newPassword">New password</label><input id="newPassword" type="password" autocomplete="new-password" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" autocomplete="new-password" required><button class="button button-secondary" type="submit">Save password</button><p id="passwordMessage" class="form-message" role="status" aria-live="polite"></p></form></section>';
  }

  function render(snapshot) {
    const name = snapshot.educatorProfile?.display_name || snapshot.user.user_metadata?.display_name || "Educator";
    const byKey = new Map(snapshot.entitlements.map(item => [item.product_key, item]));
    const cards = window.FirstVoloAccountData.definitions.map(product => { const entitlement = byKey.get(product.key); const type = entitlement && ["complimentary", "complimentary_annual"].includes(entitlement.access_type) ? "Complimentary annual" : entitlement ? entitlement.access_type : "—"; return `<article class="product"><h4>${escape(product.label)}</h4><dl><div><dt>Status</dt><dd class="${entitlement ? "active" : "inactive"}">${entitlement ? "Active" : "No active access"}</dd></div><div><dt>Access type</dt><dd>${escape(type)}</dd></div><div><dt>Expiration</dt><dd>${entitlement ? escape(expiration(entitlement.expires_at)) : "—"}</dd></div></dl></article>`; }).join("");
    content.innerHTML = `<div class="account-heading"><h2>My First Volo</h2><p>Account access and product status</p></div><section class="card"><div class="profile"><span class="profile-name">${escape(name)}</span><span class="profile-email">${escape(snapshot.user.email || "Signed-in educator")}</span></div><div class="products"><h3>My Products</h3><div class="product-grid">${cards}</div>${renderSecurity()}</div><p class="readonly-note">Product access is read-only on this page.</p></section>`;
    signOutButton.hidden = false;
    const form = document.getElementById("passwordForm");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const newInput = document.getElementById("newPassword");
      const confirmInput = document.getElementById("confirmPassword");
      const message = document.getElementById("passwordMessage");
      if (newInput.value !== confirmInput.value) { message.textContent = "Passwords do not match."; return; }
      try { const result = await window.FirstVoloAccountAuth.updatePassword(newInput.value); if (result.error) throw result.error; message.textContent = "Password saved. You can use it the next time you sign in."; newInput.value = ""; confirmInput.value = ""; } catch (error) { newInput.value = ""; confirmInput.value = ""; if (await window.FirstVoloAccountAuth.handleSessionError(error)) { renderSignedOut("Your sign-in session has expired. Please sign in again."); return; } message.textContent = "The password could not be saved. Please try again."; }
    });
  }

  async function init() {
    if (!window.FirstVoloAccountData || !window.FirstVoloAccountAuth) { showError(); return; }
    try { const snapshot = await window.FirstVoloAccountData.getAccountSnapshot(); if (!snapshot.user) { renderSignedOut(); return; } if (snapshot.error) { if (await window.FirstVoloAccountAuth.handleSessionError(snapshot.error)) { renderSignedOut("Your sign-in session has expired. Please sign in again."); return; } showError(); return; } render(snapshot); } catch (error) { if (await window.FirstVoloAccountAuth.handleSessionError(error)) { renderSignedOut("Your sign-in session has expired. Please sign in again."); return; } console.warn("My First Volo account read failed.", error); showError(); }
  }

  signOutButton.addEventListener("click", () => window.FirstVoloAccountAuth.signOut().then(() => window.location.reload()));
  init();
}());
