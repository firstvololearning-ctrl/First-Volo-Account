(function () {
  "use strict";

  const content = document.getElementById("studentContent");
  const auth = window.FirstVoloStudentAuth;
  const studentProducts = Object.freeze({
    "first-volo-morphology": Object.freeze({
      label: "Morpho",
      actionLabel: "Open Morpho",
      href: "https://firstvololearning-ctrl.github.io/First-Volo-Morphology/"
    }),
    "primo-volo": Object.freeze({
      label: "Primo",
      actionLabel: "Open Primo",
      href: "https://firstvololearning-ctrl.github.io/Primo-Volo-Italian-Learning-Hub/"
    }),
    "first-volo-story-builder": Object.freeze({
      label: "Story Builder",
      actionLabel: "Open Story Builder",
      href: "https://firstvololearning-ctrl.github.io/First-Volo-Story-Builder/"
    })
  });

  function escape(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function renderSignIn(message = "") {
    content.innerHTML = `<section class="card student-auth-card"><div class="account-heading"><p class="eyebrow">First Volo Learning</p><h2>Student Sign In</h2><p>Enter the two codes your teacher gave you.</p></div><form id="studentSignInForm" class="sign-in-form"><label for="classCode">Class Code</label><input id="classCode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required><label for="studentCode">Student Code</label><input id="studentCode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button class="button button-primary" type="submit">Sign in</button><p id="studentSignInMessage" class="form-message" role="status" aria-live="polite">${escape(message)}</p></form><div class="teacher-entry"><span>Teacher?</span><a href="index.html">Go to My First Volo</a></div></section>`;
    document.getElementById("studentSignInForm").addEventListener("submit", async event => {
      event.preventDefault();
      const classInput = document.getElementById("classCode");
      const studentInput = document.getElementById("studentCode");
      const messageElement = document.getElementById("studentSignInMessage");
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      messageElement.textContent = "Signing in…";
      const result = await auth.claimLogin(classInput.value.trim(), studentInput.value.trim());
      submit.disabled = false;
      if (result.status === "signed-in") {
        classInput.value = "";
        studentInput.value = "";
        await renderStudentHome(result.context);
        return;
      }
      studentInput.value = "";
      if (result.status === "educator-session") { renderEducatorSession(); return; }
      messageElement.textContent = result.status === "provider-unavailable" || result.status === "unavailable" ? "Student sign-in is not available yet. Please ask your teacher." : "Class code or student code could not be verified.";
    });
  }

  function renderEducatorSession() {
    content.innerHTML = '<section class="card student-auth-card"><div class="account-heading"><p class="eyebrow">First Volo Learning</p><h2>Student Sign In</h2></div><p>This browser is currently signed in to an educator account. Sign out before using Student Sign In.</p><button id="educatorSignOutButton" class="button button-primary" type="button">Sign out and continue</button><p id="educatorSignOutMessage" class="form-message" role="status" aria-live="polite"></p><div class="teacher-entry"><a href="index.html">Return to My First Volo</a></div></section>';
    document.getElementById("educatorSignOutButton").addEventListener("click", async () => {
      const message = document.getElementById("educatorSignOutMessage");
      message.textContent = "Signing out…";
      await auth.signOut();
      renderSignIn();
    });
  }

  async function renderStudentHome(context) {
    const access = await auth.getStudentProductAccess();
    const authorizedKeys = new Set(access.productKeys);
    const availableProducts = Object.entries(studentProducts).filter(([key]) => authorizedKeys.has(key)).map(([, product]) => {
      return `<li><strong>${escape(product.label)}</strong><a class="button button-primary student-product-action" href="${escape(product.href)}">${escape(product.actionLabel)}</a></li>`;
    }).join("");
    const availability = availableProducts ? `<section class="student-products"><h3>Your First Volo activities</h3><p>Available from your teacher</p><ul>${availableProducts}</ul></section>` : '<section class="student-products"><h3>Your First Volo activities</h3><p>No activities are available yet.</p></section>';
    content.innerHTML = `<section class="card student-home"><p class="eyebrow">First Volo Learning</p><h2>Hi, ${escape(context.display_name)}!</h2><p>You’re signed in to First Volo.</p><div class="student-class"><span>Class</span><strong>${escape(context.class_name)}</strong></div>${availability}<p>Your teacher will tell you which First Volo activity to open.</p><button id="studentSignOutButton" class="button button-secondary" type="button">Sign out</button></section>`;
    document.getElementById("studentSignOutButton").addEventListener("click", async () => {
      await auth.signOut();
      renderSignIn();
    });
  }

  async function init() {
    if (!auth) { renderSignIn("Student sign-in is not available yet. Please ask your teacher."); return; }
    const current = await auth.getSession();
    if (current.error || !current.session) { renderSignIn(); return; }
    if (!auth.isAnonymousSession(current.session)) { renderEducatorSession(); return; }
    const linked = await auth.getStudentContext();
    if (linked.context) { await renderStudentHome(linked.context); return; }
    renderSignIn();
  }

  init();
}());
