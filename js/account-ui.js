(function () {
  "use strict";

  const content = document.getElementById("accountContent");
  const signOutButton = document.getElementById("signOutButton");
  const client = window.FirstVoloAccountSupabase?.client;
  const studentSignInUrl = "https://firstvololearning-ctrl.github.io/First-Volo-Account/student-login.html";
  let currentSnapshot = null;
  let temporaryLogin = null;

  function escape(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function expiration(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Expiration date unavailable" : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
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
    content.innerHTML = `<section class="card"><div class="account-heading"><h2>${heading}</h2><p>Use your My First Volo account to access your products.</p></div><form id="passwordSignInForm" class="sign-in-form"><label for="signInEmail">Email</label><input id="signInEmail" type="email" autocomplete="email" required><label for="signInPassword">Password</label><input id="signInPassword" type="password" autocomplete="current-password" required><button class="button button-primary" type="submit">Sign in</button><p id="passwordSignInMessage" class="form-message" role="status" aria-live="polite"></p></form><div class="secondary-auth-actions"><button id="forgotPasswordButton" class="text-button" type="button">Forgot password?</button></div><form id="forgotPasswordForm" class="sign-in-form secondary-form" hidden><label for="resetEmail">Email</label><input id="resetEmail" type="email" autocomplete="email" required><button class="button button-secondary" type="submit">Send password-reset link</button><p id="resetMessage" class="form-message" role="status" aria-live="polite">If an account exists for that email, a password-reset link has been sent.</p></form><section class="email-account-panel" aria-labelledby="emailAccountHeading"><h3 id="emailAccountHeading">Create an educator account or sign in by email</h3><p>Enter your educator email. If it is new, First Volo will create the account. If it already exists, you will receive a secure sign-in link.</p><form id="magicLinkForm" class="sign-in-form"><label for="magicEmail">Educator email</label><input id="magicEmail" type="email" autocomplete="email" required><button class="button button-secondary" type="submit">Create account or email sign-in link</button><p id="magicMessage" class="form-message" role="status" aria-live="polite"></p></form></section><div class="student-entry"><span>Student?</span><a href="student-login.html">Student sign in →</a></div><p class="readonly-note">New educator accounts require product access from a First Volo administrator.</p></section>`;

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
    document.getElementById("forgotPasswordButton").addEventListener("click", () => { forgotForm.hidden = !forgotForm.hidden; });
    forgotForm.addEventListener("submit", async event => {
      event.preventDefault();
      const message = document.getElementById("resetMessage");
      try { const result = await window.FirstVoloAccountAuth.requestPasswordReset(document.getElementById("resetEmail").value.trim()); if (result.error) throw result.error; } catch (error) { /* Keep the same anti-enumeration response. */ }
      message.textContent = "If an account exists for that email, a password-reset link has been sent.";
      document.getElementById("resetEmail").value = "";
    });

    document.getElementById("magicLinkForm").addEventListener("submit", async event => {
      event.preventDefault();
      const message = document.getElementById("magicMessage");
      try { const result = await window.FirstVoloAccountAuth.signInWithMagicLink(document.getElementById("magicEmail").value.trim()); if (result.error) throw result.error; message.textContent = "If the email can be used, check your inbox and open the secure First Volo link."; } catch (error) { message.textContent = isEmailRateLimit(error) ? "Too many sign-in links have been requested. Please wait a little while and try again." : "The sign-in email could not be sent. Please try again."; }
    });
  }

  function renderSecurity() {
    return '<section class="security-section"><h3>Account Security</h3><p>Set or change your password for future sign-ins.</p><form id="passwordForm" class="sign-in-form"><label for="newPassword">New password</label><input id="newPassword" type="password" autocomplete="new-password" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" autocomplete="new-password" required><button class="button button-secondary" type="submit">Save password</button><p id="passwordMessage" class="form-message" role="status" aria-live="polite"></p></form></section>';
  }

  function renderClassStudentAccess(classItem, snapshot) {
    const entitledKeys = new Set(snapshot.entitlements.map(item => item.product_key));
    const enabledKeys = new Set(snapshot.classProductAccess.filter(item => item.class_id === classItem.id).map(item => item.product_key));
    const products = window.FirstVoloAccountData.definitions.map(product => {
      if (!entitledKeys.has(product.key)) return `<div class="class-product-row"><span>${escape(product.label)}</span><small>No active educator access</small></div>`;
      return `<label class="class-product-row class-product-control"><span>${escape(product.label)}</span><input type="checkbox" data-class-product-access data-class-id="${escape(classItem.id)}" data-product-key="${escape(product.key)}"${enabledKeys.has(product.key) ? " checked" : ""}><span class="class-product-state">${enabledKeys.has(product.key) ? "Student access on" : "Student access off"}</span></label>`;
    }).join("");
    return `<section class="class-student-access" aria-label="Student access for ${escape(classItem.name)}"><h5>Student access</h5><div class="class-product-list">${products}</div><p class="form-message" data-class-access-message="${escape(classItem.id)}" role="status" aria-live="polite"></p></section>`;
  }

  function renderClasses(snapshot) {
    const classCards = snapshot.classes.length ? snapshot.classes.map(item => `<article class="management-item"><div><h4>${escape(item.name)}</h4><span class="item-label">Class Code</span><strong class="code-value">${escape(item.class_code)}</strong></div>${renderClassStudentAccess(item, snapshot)}</article>`).join("") : '<p class="empty-state">No classes yet. Create your first class below.</p>';
    return `<section class="management-section" aria-labelledby="classesHeading"><div class="section-heading"><div><h3 id="classesHeading">My Classes</h3><p>Create a class and share its Class Code with your students.</p></div></div><div class="management-grid">${classCards}</div><details class="create-panel"><summary class="button button-secondary">Create class</summary><form id="createClassForm" class="compact-form"><label for="className">Class name</label><input id="className" type="text" maxlength="120" autocomplete="off" required><button class="button button-primary" type="submit">Create class</button><p id="createClassMessage" class="form-message" role="status" aria-live="polite"></p></form></details></section>`;
  }

  function renderStudents(snapshot) {
    const options = snapshot.classes.map(item => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
    const storyBuilderKey = "first-volo-story-builder";
    const hasStoryBuilderEntitlement = snapshot.entitlements.some(item => item.product_key === storyBuilderKey);
    const storyBuilderClassIds = new Set(snapshot.classProductAccess.filter(item => item.product_key === storyBuilderKey).map(item => item.class_id));
    const storyBuilderUrl = window.FirstVoloAccountReturnTargets.destinationFor("storyBuilder");
    const morphologyKey = "first-volo-morphology";
    const hasMorphologyEntitlement = snapshot.entitlements.some(item => item.product_key === morphologyKey);
    const morphologyClassIds = new Set(snapshot.classProductAccess.filter(item => item.product_key === morphologyKey).map(item => item.class_id));
    const morphologyProgressUrl = window.FirstVoloAccountReturnTargets.detailedProgressFor("morphology");
    const primoKey = "primo-volo";
    const hasPrimoEntitlement = snapshot.entitlements.some(item => item.product_key === primoKey);
    const primoClassIds = new Set(snapshot.classProductAccess.filter(item => item.product_key === primoKey).map(item => item.class_id));
    const primoProgressUrl = window.FirstVoloAccountReturnTargets.detailedProgressFor("primoVolo");
    const rows = snapshot.students.length ? snapshot.students.map(student => {
      const detailedProgress = [
        hasStoryBuilderEntitlement && storyBuilderClassIds.has(student.class_id) && storyBuilderUrl
          ? `<a class="student-progress-action" href="${escape(`${storyBuilderUrl}?studentId=${encodeURIComponent(student.id)}`)}">Open Story Builder</a>`
          : "",
        hasMorphologyEntitlement && morphologyClassIds.has(student.class_id) && morphologyProgressUrl
          ? `<a class="student-progress-action" href="${escape(`${morphologyProgressUrl}?studentId=${encodeURIComponent(student.id)}`)}">View Morphology Progress →</a>`
          : "",
        hasPrimoEntitlement && primoClassIds.has(student.class_id) && primoProgressUrl
          ? `<a class="student-progress-action" href="${escape(`${primoProgressUrl}?studentId=${encodeURIComponent(student.id)}`)}">View Primo Progress →</a>`
          : ""
      ].filter(Boolean).join(" ");
      return `<article class="student-item"><div><h4>${escape(student.display_name)}</h4><p>${escape(student.class_name)}</p>${student.student_code_hint ? `<span class="login-status">Login created • ending ${escape(student.student_code_hint)}</span><span class="login-helper">Need another copy? Reset the login to create a new Student Code.</span>` : '<span class="login-status">Login not created</span>'}${detailedProgress}</div><div class="student-actions"><button class="button button-secondary" type="button" data-student-action="login" data-student-id="${escape(student.id)}">${student.student_code_hint ? "Reset login" : "Generate login"}</button><button class="text-button danger-text" type="button" data-student-action="revoke" data-student-id="${escape(student.id)}">Sign student out everywhere</button></div></article>`;
    }).join("") : '<p class="empty-state">No students yet.</p>';
    const addForm = snapshot.classes.length ? `<form id="addStudentForm" class="compact-form"><label for="studentClass">Class</label><select id="studentClass" required>${options}</select><label for="studentName">Student display name</label><input id="studentName" type="text" maxlength="120" autocomplete="off" placeholder="Maya R." required><button class="button button-primary" type="submit">Add student</button><p id="addStudentMessage" class="form-message" role="status" aria-live="polite"></p></form>` : '<p class="empty-state">Create a class before adding students.</p>';
    return `<section class="management-section" aria-labelledby="studentsHeading"><div class="section-heading"><div><h3 id="studentsHeading">My Students</h3><p>Create student identities and manage their First Volo sign-ins.</p></div></div><div class="student-list">${rows}</div><details class="create-panel"><summary class="button button-secondary">Add student</summary>${addForm}</details><p id="studentActionMessage" class="form-message" role="status" aria-live="polite"></p></section>`;
  }

  function renderTemporaryLogin() {
    if (!temporaryLogin) return "";
    return `<section id="temporaryLoginCard" class="login-card" aria-labelledby="loginCardHeading"><p class="eyebrow">First Volo Learning</p><h3 id="loginCardHeading">Student Sign In</h3><div class="login-destination"><span>Go to:</span><a href="${studentSignInUrl}" target="_blank" rel="noopener">${studentSignInUrl}</a></div><dl><div><dt>Student</dt><dd>${escape(temporaryLogin.studentName)}</dd></div><div><dt>Class</dt><dd>${escape(temporaryLogin.className)}</dd></div><div><dt>Class Code</dt><dd class="code-value">${escape(temporaryLogin.classCode)}</dd></div><div><dt>Student Code</dt><dd class="code-value student-code">${escape(temporaryLogin.studentCode)}</dd></div></dl><p class="temporary-warning">This is the only time the full Student Code will be shown. Give it to the student before closing this card.</p><div class="login-card-actions"><button id="copyLoginButton" class="button button-primary" type="button">Copy login</button><button id="printLoginButton" class="button button-secondary" type="button">Print login card</button><button id="dismissLoginButton" class="button button-secondary" type="button">Done</button></div><p id="loginCardMessage" class="form-message" role="status" aria-live="polite"></p></section>`;
  }

  function render(snapshot) {
    currentSnapshot = snapshot;
    const name = snapshot.educatorProfile?.display_name || snapshot.user.user_metadata?.display_name || "Educator";
    const byKey = new Map(snapshot.entitlements.map(item => [item.product_key, item]));
    const cards = window.FirstVoloAccountData.definitions.map(product => {
      const entitlement = byKey.get(product.key);
      const openUrl = window.FirstVoloAccountReturnTargets.destinationFor(product.returnTarget);
      const accessText = entitlement ? `Active through ${expiration(entitlement.expires_at)}` : "No active access";
      const actions = entitlement
        ? (openUrl ? `<a class="button button-primary product-primary-action" href="${escape(openUrl)}">Open ${escape(product.label)}</a>` : '<p class="product-note">Product opening is not currently available from this account.</p>')
        : `<a class="button button-primary product-primary-action" href="${escape(product.learnMoreUrl)}" target="_blank" rel="noopener noreferrer">Visit First Volo Learning</a><p class="product-note">Access is not active for this product.</p>`;
      return `<article class="product ${entitlement ? "product-active" : "product-inactive"}"><div class="product-overview"><h4>${escape(product.label)}</h4><p>${escape(product.description)}</p></div><div class="product-access"><span class="product-access-label">Your access</span><strong class="${entitlement ? "active" : "inactive"}">${escape(accessText)}</strong></div><div class="product-actions">${actions}</div></article>`;
    }).join("");
    const adminAction = snapshot.isEntitlementAdmin ? '<p><a class="button button-secondary" href="admin.html">Manage educator subscriptions</a></p>' : "";
    content.innerHTML = `<div class="account-heading"><h2>My First Volo</h2><p>Account access and product status</p></div>${renderTemporaryLogin()}<section class="card"><div class="profile"><span class="profile-name">${escape(name)}</span><span class="profile-email">${escape(snapshot.user.email || "Signed-in educator")}</span></div>${adminAction}<section class="products" aria-labelledby="productsHeading"><div class="section-heading product-section-heading"><h3 id="productsHeading">First Volo Products</h3><p>Explore First Volo tools and see your current access.</p></div><div class="product-grid">${cards}</div></section>${renderClasses(snapshot)}${renderStudents(snapshot)}${renderSecurity()}<p class="readonly-note">Educator product entitlements are view-only here. You can manage classes, students, sign-ins, and class-level student access.</p></section>`;
    signOutButton.hidden = false;
    bindEducatorEvents();
  }

  async function refreshSnapshot() {
    const snapshot = await window.FirstVoloAccountData.getAccountSnapshot();
    if (snapshot.error) throw snapshot.error;
    render(snapshot);
  }

  function bindEducatorEvents() {
    document.querySelectorAll("[data-class-product-access]").forEach(control => control.addEventListener("change", async () => {
      const requestedState = control.checked;
      const message = document.querySelector(`[data-class-access-message="${control.dataset.classId}"]`);
      control.disabled = true;
      message.textContent = "Saving student access…";
      const result = await client.rpc("set_class_product_access", { p_class_id: control.dataset.classId, p_product_key: control.dataset.productKey, p_enabled: requestedState });
      if (result.error) {
        control.checked = !requestedState;
        control.disabled = false;
        message.textContent = "Student access could not be updated. Please try again.";
        return;
      }
      await refreshSnapshot();
    }));

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
      const loginText = `First Volo Student Sign In\n${studentSignInUrl}\n\nStudent: ${temporaryLogin.studentName}\nClass: ${temporaryLogin.className}\nClass Code: ${temporaryLogin.classCode}\nStudent Code: ${temporaryLogin.studentCode}`;
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
