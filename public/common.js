const App = (() => {
  async function api(path, options = {}) {
    const headers = options.headers || {};
    const config = {
      credentials: "same-origin",
      ...options,
      headers
    };

    if (config.body && !(config.body instanceof FormData) && !headers["Content-Type"]) {
      config.headers = { ...headers, "Content-Type": "application/json" };
    }

    const response = await fetch(path, config);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const message = data && data.error ? data.error : "请求失败";
      throw new Error(message);
    }

    return data;
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 2800);
  }

  async function requireAuth(roles = []) {
    try {
      const { user } = await api("/api/auth/me");
      if (roles.length && !roles.includes(user.role)) {
        window.location.href = user.role === "admin" ? "/admin.html" : "/doctor.html";
        return null;
      }
      renderUser(user);
      return user;
    } catch (error) {
      window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return null;
    }
  }

  function renderUser(user) {
    const node = document.querySelector("[data-current-user]");
    if (node && user) {
      node.textContent = `${user.display_name} · ${user.role === "admin" ? "管理员" : "医生"}`;
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  }

  function bindLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        logout().catch((error) => toast(error.message));
      });
    });
  }

  function fmt(value) {
    return value === null || value === undefined || value === "" ? "—" : value;
  }

  function escape(value) {
    return String(fmt(value))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function boolText(value) {
    return value ? "是" : "否";
  }

  function pill(text, type = "info") {
    return `<span class="pill ${type}">${text}</span>`;
  }

  function riskPills(risks) {
    if (!risks || !risks.length) return pill("无预警", "ok");
    return risks.map((risk) => pill(risk.title, risk.level === "danger" ? "danger" : "warn")).join(" ");
  }

  function formJSON(form) {
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    form.querySelectorAll('input[type="checkbox"]').forEach((item) => {
      data[item.name] = item.checked ? 1 : 0;
    });
    return data;
  }

  function bindScoreOutputs(root = document) {
    root.querySelectorAll('input[type="range"]').forEach((input) => {
      const output = root.querySelector(`[data-score-output="${input.name}"]`);
      const update = () => {
        if (output) output.textContent = input.value;
      };
      input.addEventListener("input", update);
      update();
    });
  }

  function setButtonBusy(button, busyText = "处理中") {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ${busyText}`;
    return () => {
      button.disabled = false;
      button.innerHTML = original;
    };
  }

  return {
    api,
    toast,
    requireAuth,
    logout,
    bindLogout,
    fmt,
    escape,
    boolText,
    pill,
    riskPills,
    formJSON,
    bindScoreOutputs,
    setButtonBusy
  };
})();
