(function () {
  "use strict";

  const content = document.getElementById("studentContent");
  const auth = window.FirstVoloStudentAuth;

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
        renderStudentHome(result.context);
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

  function renderStudentHome(context) {
    content.innerHTML = `<section class="card student-home"><p class="eyebrow">First Volo Learning</p><h2>Hi, ${escape(context.display_name)}!</h2><p>You’re signed in to First Volo.</p><div class="student-class"><span>Class</span><strong>${escape(context.class_name)}</strong></div><p>Your teacher will tell you which First Volo activity to open.</p><button id="studentSignOutButton" class="button button-secondary" type="button">Sign out</button></section>`;
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
    if (linked.context) { renderStudentHome(linked.context); return; }
    renderSignIn();
  }

  init();
}());
