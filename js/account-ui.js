(function () {
  "use strict";

  const content = document.getElementById("accountContent");
  const signOutButton = document.getElementById("signOutButton");
  const client = window.FirstVoloAccountSupabase?.client;
  let currentSnapshot = null;
  let temporaryLogin = null;

  function escape(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
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
    content.innerHTML = `<section class="card"><div class="account-heading"><h2>${heading}</h2><p>Use your My First Volo account to access your products.</p></div><form id="passwordSignInForm" class="sign-in-form"><label for="signInEmail">Email</label><input id="signInEmail" type="email" autocomplete="email" required><label for="signInPassword">Password</label><input id="signInPassword" type="password" autocomplete="current-password" required><button class="button button-primary" type="submit">Sign in</button><p id="passwordSignInMessage" class="form-message" role="status" aria-live="polite"></p></form><div class="secondary-auth-actions"><button id="forgotPasswordButton" class="text-button" type="button">Forgot password?</button><button id="magicLinkButton" class="text-button" type="button">Email me a sign-in link instead</button></div><form id="forgotPasswordForm" class="sign-in-form secondary-form" hidden><label for="resetEmail">Email</label><input id="resetEmail" type="email" autocomplete="email" required><button class="button button-secondary" type="submit">Send password-reset link</button><p id="resetMessage" class="form-message" role="status" aria-live="polite">If an account exists for that email, a password-reset link has been sent.</p></form><form id="magicLinkForm" class="sign-in-form secondary-form" hidden><label for="magicEmail">Email</label><input id="magicEmail" type="email" autocomplete="email" required><button class="button button-secondary" type="submit">Email me a sign-in link</button><p id="magicMessage" class="form-message" role="status" aria-live="polite"></p></form><div class="student-entry"><span>Student?</span><a href="student-login.html">Student sign in →</a></div><p class="readonly-note">Your account and product access are read-only here.</p></section>`;

    const passwordForm = document.getElementById("passwordSignInForm");
    const passwordMessage = document.getElementById("passwordSignInMessage");
    if (messageText) passwordMessage.textContent = messageText;
    passwordForm.addEventListener("submit", async event => {
      event.preventDefault();
      passwordMessage.textContent = "Signing in…";
      try {
        const result = await window.FirstVoloAccountAuth.signInWithPassword(document.getElementById("signInEmail").value.trim(), document.getElementById("signInPassword").value);
        if (result.error) throw result.error;
      } catch (error) {
        if (await window.FirstVoloAccountAuth.handleSessionError(error)) { renderSignedOut("Your sign-in session has expired. Please sign in again."); return; }
        passwordMessage.textContent = "Email or password could not be verified.";
      } finally {
        document.getElementById("signInPassword").value = "";
      }
    });

    const forgotForm = document.getElementById("forgotPasswordForm");
    const magicForm = document.getElementById("magicLinkForm");
    document.getElementById("forgotPasswordButton").addEventListener("click", () => { const shouldOpen = forgotForm.hidden; magicForm.hidden = true; forgotForm.hidden = !shouldOpen; });
    forgotForm.addEventListener("submit", async event => {
      event.preventDefault();
      const message = document.getElementById("resetMessage");
      try { const result = await window.FirstVoloAccountAuth.requestPasswordReset(document.getElementById("resetEmail").value.trim()); if (result.error) throw result.error; } catch (error) { /* Keep the same anti-enumeration response. */ }
      message.textContent = "If an account exists for that email, a password-reset link has been sent.";
      document.getElementById("resetEmail").value = "";
    });

    document.getElementById("magicLinkButton").addEventListener("click", () => { const shouldOpen = magicForm.hidden; forgotForm.hidden = true; magicForm.hidden = !shouldOpen; });
    magicForm.addEventListener("submit", async event => {
      event.preventDefault();
      const message = document.getElementById("magicMessage");
      try { const result = await window.FirstVoloAccountAuth.signInWithMagicLink(document.getElementById("magicEmail").value.trim()); if (result.error) throw result.error; message.textContent = "Check your email and open the First Volo sign-in link."; } catch (error) { message.textContent = isEmailRateLimit(error) ? "Too many sign-in links have been requested. Please wait a little while and try again." : "The sign-in email could not be sent. Please try again."; }
    });
  }

  function renderSecurity() {
    return '<section class="security-section"><h3>Account Security</h3><p>Set or change your password for future sign-ins.</p><form id="passwordForm" class="sign-in-form"><label for="newPassword">New password</label><input id="newPassword" type="password" autocomplete="new-password" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" autocomplete="new-password" required><button class="button button-secondary" type="submit">Save password</button><p id="passwordMessage" class="form-message" role="status" aria-live="polite"></p></form></section>';
  }

  function renderClasses(snapshot) {
    const classCards = snapshot.classes.length ? snapshot.classes.map(item => `<article class="management-item"><div><h4>${escape(item.name)}</h4><span class="item-label">Class Code</span><strong class="code-value">${escape(item.class_code)}</strong></div></article>`).join("") : '<p class="empty-state">No classes yet. Create your first class below.</p>';
    return `<section class="management-section" aria-labelledby="classesHeading"><div class="section-heading"><div><h3 id="classesHeading">My Classes</h3><p>Create a class and share its Class Code with your students.</p></div></div><div class="management-grid">${classCards}</div><details class="create-panel"><summary class="button button-secondary">Create class</summary><form id="createClassForm" class="compact-form"><label for="className">Class name</label><input id="className" type="text" maxlength="120" autocomplete="off" required><button class="button button-primary" type="submit">Create class</button><p id="createClassMessage" class="form-message" role="status" aria-live="polite"></p></form></details></section>`;
  }

  function renderStudents(snapshot) {
    const options = snapshot.classes.map(item => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
    const rows = snapshot.students.length ? snapshot.students.map(student => `<article class="student-item"><div><h4>${escape(student.display_name)}</h4><p>${escape(student.class_name)}</p><span class="login-status">${student.student_code_hint ? `Login created • ending ${escape(student.student_code_hint)}` : "Login not created"}</span></div><div class="student-actions"><button class="button button-secondary" type="button" data-student-action="login" data-student-id="${escape(student.id)}">${student.student_code_hint ? "Reset login" : "Generate login"}</button><button class="text-button danger-text" type="button" data-student-action="revoke" data-student-id="${escape(student.id)}">Sign student out everywhere</button></div></article>`).join("") : '<p class="empty-state">No students yet.</p>';
    const addForm = snapshot.classes.length ? `<form id="addStudentForm" class="compact-form"><label for="studentClass">Class</label><select id="studentClass" required>${options}</select><label for="studentName">Student display name</label><input id="studentName" type="text" maxlength="120" autocomplete="off" placeholder="Maya R." required><button class="button button-primary" type="submit">Add student</button><p id="addStudentMessage" class="form-message" role="status" aria-live="polite"></p></form>` : '<p class="empty-state">Create a class before adding students.</p>';
    return `<section class="management-section" aria-labelledby="studentsHeading"><div class="section-heading"><div><h3 id="studentsHeading">My Students</h3><p>Create student identities and manage their First Volo sign-ins.</p></div></div><div class="student-list">${rows}</div><details class="create-panel"><summary class="button button-secondary">Add student</summary>${addForm}</details><p id="studentActionMessage" class="form-message" role="status" aria-live="polite"></p></section>`;
  }

  function renderTemporaryLogin() {
    if (!temporaryLogin) return "";
    return `<section id="temporaryLoginCard" class="login-card" aria-labelledby="loginCardHeading"><p class="eyebrow">First Volo Learning</p><h3 id="loginCardHeading">Student login</h3><dl><div><dt>Student</dt><dd>${escape(temporaryLogin.studentName)}</dd></div><div><dt>Class</dt><dd>${escape(temporaryLogin.className)}</dd></div><div><dt>Class Code</dt><dd class="code-value">${escape(temporaryLogin.classCode)}</dd></div><div><dt>Student Code</dt><dd class="code-value student-code">${escape(temporaryLogin.studentCode)}</dd></div><div><dt>Student sign-in</dt><dd>student-login.html</dd></div></dl><p class="temporary-warning">This is the only time the full Student Code will be shown. Give it to the student before closing this card.</p><div class="login-card-actions"><button id="copyLoginButton" class="button button-primary" type="button">Copy login</button><button id="printLoginButton" class="button button-secondary" type="button">Print login card</button><button id="dismissLoginButton" class="button button-secondary" type="button">Done</button></div><p id="loginCardMessage" class="form-message" role="status" aria-live="polite"></p></section>`;
  }

  function render(snapshot) {
    currentSnapshot = snapshot;
    const name = snapshot.educatorProfile?.display_name || snapshot.user.user_metadata?.display_name || "Educator";
    const byKey = new Map(snapshot.entitlements.map(item => [item.product_key, item]));
    const cards = window.FirstVoloAccountData.definitions.map(product => { const entitlement = byKey.get(product.key); const type = entitlement && ["complimentary", "complimentary_annual"].includes(entitlement.access_type) ? "Complimentary annual" : entitlement ? entitlement.access_type : "—"; return `<article class="product"><h4>${escape(product.label)}</h4><dl><div><dt>Status</dt><dd class="${entitlement ? "active" : "inactive"}">${entitlement ? "Active" : "No active access"}</dd></div><div><dt>Access type</dt><dd>${escape(type)}</dd></div><div><dt>Expiration</dt><dd>${entitlement ? escape(expiration(entitlement.expires_at)) : "—"}</dd></div></dl></article>`; }).join("");
    content.innerHTML = `<div class="account-heading"><h2>My First Volo</h2><p>Account access and product status</p></div>${renderTemporaryLogin()}<section class="card"><div class="profile"><span class="profile-name">${escape(name)}</span><span class="profile-email">${escape(snapshot.user.email || "Signed-in educator")}</span></div><section class="products"><h3>My Products</h3><div class="product-grid">${cards}</div></section>${renderClasses(snapshot)}${renderStudents(snapshot)}${renderSecurity()}<p class="readonly-note">Product access is read-only on this page.</p></section>`;
    signOutButton.hidden = false;
    bindEducatorEvents();
  }

  async function refreshSnapshot() {
    const snapshot = await window.FirstVoloAccountData.getAccountSnapshot();
    if (snapshot.error) throw snapshot.error;
    render(snapshot);
  }

  function bindEducatorEvents() {
    document.getElementById("createClassForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const input = document.getElementById("className");
      const message = document.getElementById("createClassMessage");
      message.textContent = "Creating class…";
      const result = await client.rpc("create_class_with_code", { p_name: input.value.trim() });
      if (result.error) { message.textContent = "The class could not be created. Please try again."; return; }
      input.value = "";
      await refreshSnapshot();
    });

    document.getElementById("addStudentForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const nameInput = document.getElementById("studentName");
      const message = document.getElementById("addStudentMessage");
      message.textContent = "Adding student…";
      const result = await client.rpc("create_student_in_class", { p_display_name: nameInput.value.trim(), p_class_id: document.getElementById("studentClass").value });
      if (result.error) { message.textContent = "The student could not be added. Please try again."; return; }
      nameInput.value = "";
      await refreshSnapshot();
    });

    document.querySelectorAll("[data-student-action]").forEach(button => button.addEventListener("click", async () => {
      const student = currentSnapshot.students.find(item => item.id === button.dataset.studentId);
      if (!student) return;
      const message = document.getElementById("studentActionMessage");
      if (button.dataset.studentAction === "login") {
        if (student.student_code_hint && !window.confirm(`Reset the login for ${student.display_name}? Their current Student Code and active sign-ins will stop working.`)) return;
        button.disabled = true;
        const result = await client.rpc("generate_student_login_code", { p_student_id: student.id });
        button.disabled = false;
        const generated = Array.isArray(result.data) ? result.data[0] : result.data;
        if (result.error || !generated?.student_code) { message.textContent = "The student login could not be created. Please try again."; return; }
        temporaryLogin = { studentName: student.display_name, className: student.class_name, classCode: student.class_code, studentCode: generated.student_code };
        await refreshSnapshot();
        document.getElementById("temporaryLoginCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (!window.confirm(`Sign ${student.display_name} out everywhere?`)) return;
      button.disabled = true;
      const result = await client.rpc("revoke_student_sessions", { p_student_id: student.id });
      button.disabled = false;
      message.textContent = result.error ? "Student sign-ins could not be disabled. Please try again." : "Current student sign-ins have been disabled. The student can sign in again with the current Class Code and Student Code.";
    }));

    document.getElementById("copyLoginButton")?.addEventListener("click", async () => {
      const message = document.getElementById("loginCardMessage");
      const loginText = `FIRST VOLO LEARNING\n\nStudent: ${temporaryLogin.studentName}\nClass: ${temporaryLogin.className}\n\nClass Code:\n${temporaryLogin.classCode}\n\nStudent Code:\n${temporaryLogin.studentCode}\n\nStudent sign-in:\n${new URL("student-login.html", window.location.href).href}`;
      try { await navigator.clipboard.writeText(loginText); message.textContent = "Login copied."; } catch (error) { message.textContent = "Copy was unavailable. Select the codes above to copy them."; }
    });
    document.getElementById("printLoginButton")?.addEventListener("click", () => window.print());
    document.getElementById("dismissLoginButton")?.addEventListener("click", () => { temporaryLogin = null; render(currentSnapshot); });

    document.getElementById("passwordForm").addEventListener("submit", async event => {
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
    try {
      const snapshot = await window.FirstVoloAccountData.getAccountSnapshot();
      if (!snapshot.user) { renderSignedOut(); return; }
      if (snapshot.anonymous) { window.location.replace("student-login.html"); return; }
      if (snapshot.error) { if (await window.FirstVoloAccountAuth.handleSessionError(snapshot.error)) { renderSignedOut("Your sign-in session has expired. Please sign in again."); return; } showError(); return; }
      render(snapshot);
    } catch (error) {
      if (await window.FirstVoloAccountAuth.handleSessionError(error)) { renderSignedOut("Your sign-in session has expired. Please sign in again."); return; }
      console.warn("My First Volo account read failed.", error);
      showError();
    }
  }

  signOutButton.addEventListener("click", () => window.FirstVoloAccountAuth.signOut().then(() => window.location.reload()));
  init();
}());
