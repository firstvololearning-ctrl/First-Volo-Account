(function () {
  "use strict";

  const content = document.getElementById("adminContent");
  const client = window.FirstVoloAccountSupabase?.client;
  const products = [
    ["first-volo-morphology", "Morphology"],
    ["first-volo-story-builder", "Story Builder"],
    ["primo-volo", "Primo Volo"]
  ];
  let educator = null;
  let educatorDirectory = [];

  function escape(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function dateValue(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  function defaultExpiration() {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  function formattedDate(value, fallback = "Never") {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function productNames(keys) {
    const labels = new Map(products);
    return (keys || []).map(key => labels.get(key) || key);
  }

  function renderDirectory() {
    const container = document.getElementById("educatorDirectory");
    if (!educatorDirectory.length) {
      container.innerHTML = '<p class="empty-state">No educator accounts have been created yet.</p>';
      return;
    }
    container.innerHTML = `<div class="educator-directory-list">${educatorDirectory.map(item => {
      const access = productNames(item.active_product_keys);
      return `<article class="educator-directory-item"><div class="educator-identity"><strong>${escape(item.display_name || "Educator")}</strong><span>${escape(item.email)}</span></div><dl><div><dt>Last successful sign-in</dt><dd>${escape(formattedDate(item.last_sign_in_at))}</dd></div><div><dt>Account created</dt><dd>${escape(formattedDate(item.created_at, "Unavailable"))}</dd></div><div><dt>Current product access</dt><dd>${access.length ? access.map(escape).join(", ") : "No active access"}</dd></div></dl><button class="button button-secondary" type="button" data-manage-educator="${escape(item.email)}">Manage access</button></article>`;
    }).join("")}</div>`;
    document.querySelectorAll("[data-manage-educator]").forEach(button => button.addEventListener("click", () => {
      document.getElementById("educatorEmail").value = button.dataset.manageEducator;
      document.getElementById("educatorSearchForm").requestSubmit();
      document.getElementById("educatorResult").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  async function loadDirectory() {
    const message = document.getElementById("directoryMessage");
    message.textContent = "Loading educator accounts…";
    const response = await client.rpc("list_educator_accounts");
    if (response.error) { message.textContent = "Educator accounts could not be loaded."; return; }
    educatorDirectory = Array.isArray(response.data) ? response.data : [];
    message.textContent = "";
    renderDirectory();
  }

  function renderShell() {
    content.innerHTML = `<section class="card admin-card"><h2>Educator accounts</h2><p>View educator sign-in activity and current product access. This information is visible only to authorized First Volo administrators.</p><p id="directoryMessage" class="form-message" role="status"></p><section id="educatorDirectory" aria-label="Educator accounts"></section><div class="admin-lookup"><h3>Find an educator</h3><p>Search by exact email address to manage access.</p><form id="educatorSearchForm" class="admin-search"><label for="educatorEmail">Educator email</label><div><input id="educatorEmail" type="email" autocomplete="off" required><button class="button button-primary" type="submit">Find educator</button></div><p id="adminMessage" class="form-message" role="status"></p></form><section id="educatorResult"></section></div></section>`;
    document.getElementById("educatorSearchForm").addEventListener("submit", search);
    loadDirectory();
  }

  function renderEducator() {
    const result = document.getElementById("educatorResult");
    const byProduct = new Map();
    educator.entitlements.filter(item => item.status === "active" && new Date(item.expires_at) > new Date()).forEach(item => {
      if (!byProduct.has(item.product_key)) byProduct.set(item.product_key, item);
    });
    result.innerHTML = `<div class="educator-result"><h3>${escape(educator.display_name || "Educator")}</h3><p>${escape(educator.email)}</p><div class="admin-product-list">${products.map(([key, label]) => {
      const current = byProduct.get(key);
      return `<form class="admin-product" data-product-form data-product-key="${key}"><div><h4>${label}</h4><p>${current ? `Active through ${escape(new Date(current.expires_at).toLocaleDateString())}` : "No active access"}</p></div><label>Expiration date<input name="expires" type="date" value="${escape(dateValue(current?.expires_at) || defaultExpiration())}" required></label><div class="admin-actions"><button class="button button-primary" name="action" value="grant" type="submit">${current ? "Extend or replace" : "Grant complimentary access"}</button>${current ? '<button class="button button-secondary" name="action" value="deactivate" type="submit">Deactivate</button>' : ""}</div></form>`;
    }).join("")}</div><p id="subscriptionMessage" class="form-message" role="status"></p></div>`;
    document.querySelectorAll("[data-product-form]").forEach(form => form.addEventListener("submit", updateSubscription));
  }

  async function search(event) {
    event.preventDefault();
    const message = document.getElementById("adminMessage");
    message.textContent = "Looking up educator…";
    const response = await client.rpc("find_educator_entitlements", { p_email: document.getElementById("educatorEmail").value.trim() });
    if (response.error) { message.textContent = "The educator lookup could not be completed."; return; }
    if (!response.data?.found) { educator = null; document.getElementById("educatorResult").innerHTML = ""; message.textContent = "No existing educator account was found for that email."; return; }
    educator = response.data;
    message.textContent = "";
    renderEducator();
  }

  async function updateSubscription(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = event.submitter;
    const enabled = submitter?.value !== "deactivate";
    if (!enabled && !window.confirm(`Deactivate ${form.dataset.productKey} access for ${educator.email}?`)) return;
    const message = document.getElementById("subscriptionMessage");
    message.textContent = enabled ? "Saving complimentary access…" : "Deactivating access…";
    form.querySelectorAll("button, input").forEach(control => { control.disabled = true; });
    const expiration = new Date(`${form.elements.expires.value}T23:59:59.999Z`).toISOString();
    const response = await client.rpc("set_educator_complimentary_access", {
      p_target_user_id: educator.user_id,
      p_product_key: form.dataset.productKey,
      p_expires_at: expiration,
      p_enabled: enabled
    });
    if (response.error) { message.textContent = "Access could not be updated."; form.querySelectorAll("button, input").forEach(control => { control.disabled = false; }); return; }
    const refreshed = await client.rpc("find_educator_entitlements", { p_email: educator.email });
    educator = refreshed.data;
    renderEducator();
    document.getElementById("subscriptionMessage").textContent = enabled ? "Complimentary access saved." : "Access deactivated.";
    loadDirectory();
  }

  async function init() {
    const user = await window.FirstVoloAccountAuth.ready();
    if (!client || !user || user.is_anonymous) { content.innerHTML = '<section class="card error"><h2>Administrator sign-in required</h2><p>Sign in through My First Volo first.</p></section>'; return; }
    const status = await client.rpc("get_entitlement_admin_status");
    if (status.error || status.data !== true) { content.innerHTML = '<section class="card error"><h2>Administrator access unavailable</h2><p>This account is not authorized to manage subscriptions.</p></section>'; return; }
    renderShell();
  }

  init();
}());
