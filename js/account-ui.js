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
    return Number.isNaN(date.getTime())
      ? "Expiration date unavailable"
      : `Access through ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date)}`;
  }

  function isEmailRateLimit(error) {
    const status = Number(error?.status || error?.statusCode);
    const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
    return status === 429 || text.includes("rate limit") || text.includes("too many requests");
  }

  function showError() {
    content.innerHTML = '<section class="card error"><strong>Account access could not be verified.</strong><p>Please try again later.</p></section>';
  }

  function renderSignedOut() {
    content.innerHTML = '<section class="card"><div class="account-heading"><h2>Sign in to My First Volo</h2><p>Use an adult email to receive a secure sign-in link.</p></div><form id="signInForm" class="sign-in-form"><label for="signInEmail">Adult email</label><input id="signInEmail" type="email" autocomplete="email" required placeholder="you@example.com"><button class="button button-primary" type="submit">Send sign-in link</button><p id="signInMessage" class="readonly-note">Your account and product access are read-only here.</p></form></section>';
    const form = document.getElementById("signInForm");
    const message = document.getElementById("signInMessage");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      message.textContent = "Sending sign-in link…";
      try {
        const result = await window.FirstVoloAccountAuth.signIn(document.getElementById("signInEmail").value.trim());
        if (result.error) throw result.error;
        message.textContent = "Check your email and open the First Volo sign-in link.";
      } catch (error) {
        console.warn("My First Volo sign-in failed.", error);
        message.textContent = isEmailRateLimit(error)
          ? "Too many sign-in links have been requested. Please wait a little while and try again."
          : "The sign-in email could not be sent. Please try again.";
      }
    });
  }

  function render(snapshot) {
    const name = snapshot.educatorProfile?.display_name || snapshot.user.user_metadata?.display_name || "Educator";
    const byKey = new Map(snapshot.entitlements.map(item => [item.product_key, item]));
    const cards = window.FirstVoloAccountData.definitions.map(product => {
      const entitlement = byKey.get(product.key);
      const type = entitlement && ["complimentary", "complimentary_annual"].includes(entitlement.access_type)
        ? "Complimentary annual"
        : entitlement ? entitlement.access_type : "—";
      return `<article class="product"><h4>${escape(product.label)}</h4><dl><div><dt>Status</dt><dd class="${entitlement ? "active" : "inactive"}">${entitlement ? "Active" : "No active access"}</dd></div><div><dt>Access type</dt><dd>${escape(type)}</dd></div><div><dt>Expiration</dt><dd>${entitlement ? escape(expiration(entitlement.expires_at)) : "—"}</dd></div></dl></article>`;
    }).join("");
    content.innerHTML = `<div class="account-heading"><h2>My First Volo</h2><p>Account access and product status</p></div><section class="card"><div class="profile"><span class="profile-name">${escape(name)}</span><span class="profile-email">${escape(snapshot.user.email || "Signed-in educator")}</span></div><div class="products"><h3>My Products</h3><div class="product-grid">${cards}</div></div><p class="readonly-note">Product access is read-only on this page.</p></section>`;
    signOutButton.hidden = false;
  }

  async function init() {
    if (!window.FirstVoloAccountData || !window.FirstVoloAccountAuth) { showError(); return; }
    try {
      const snapshot = await window.FirstVoloAccountData.getAccountSnapshot();
      if (!snapshot.user) { renderSignedOut(); return; }
      if (snapshot.error) { showError(); return; }
      render(snapshot);
    } catch (error) { console.warn("My First Volo account read failed.", error); showError(); }
  }

  signOutButton.addEventListener("click", () => window.FirstVoloAccountAuth.signOut().then(() => window.location.reload()));
  init();
}());
