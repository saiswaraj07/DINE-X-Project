// admin-login.html and admin-dashboard.html load only this file (not config.js),
// so it defines its own same-origin base.
const ADMIN_API_BASE = "";
const ADMIN_TOKEN_KEY = "dinexAdminToken";
const ADMIN_STATUSES = ["PLACED", "UNDER_PROCESS", "COMPLETED"];

function wireAdminLogin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;
  const message = document.getElementById("adminLoginMessage");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(`${ADMIN_API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.ok) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        window.location.href = "admin-dashboard.html";
        return;
      }
      message.textContent = data.message;
      message.style.color = "crimson";
    } catch (error) {
      message.textContent = "Could not reach the server. Is it running?";
      message.style.color = "crimson";
    }
  });
}

function adminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function adminLogout() {
  const token = adminToken();
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  if (token) {
    // Invalidate server-side too; navigation must not wait on the response.
    fetch(`${ADMIN_API_BASE}/api/admin/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {});
  }
  window.location.replace("admin-login.html");
}

function recordCard(record, onStatusChange) {
  const card = document.createElement("div");
  card.className = "admin_record_card";

  const title = document.createElement("h3");
  title.textContent = `${record.record_type} #${record.id} `;
  const badge = document.createElement("span");
  badge.className = `admin_status ${record.status.toLowerCase()}`;
  badge.textContent = record.status.replace("_", " ");
  title.appendChild(badge);
  card.appendChild(title);

  const fields = [
    ["Name", record.customer_name],
    ["Email", record.email],
    ["Mobile", record.mobile],
    ["Order", record.food_item],
    ["Address", record.address],
    ["Pick-up time", record.pickup_time],
    ["Persons", record.persons],
    ["Dining time", record.dining_time],
    ["Placed at", record.created_at ? new Date(record.created_at).toLocaleString() : null],
  ];
  for (const [label, value] of fields) {
    if (value === null || value === undefined || value === "") continue;
    const p = document.createElement("p");
    const b = document.createElement("b");
    b.textContent = `${label}: `;
    p.appendChild(b);
    p.appendChild(document.createTextNode(String(value)));
    card.appendChild(p);
  }

  const actions = document.createElement("div");
  actions.className = "admin_actions";
  for (const status of ADMIN_STATUSES) {
    const btn = document.createElement("button");
    btn.className = "order_btn admin_btn admin_action_btn";
    btn.textContent = `Mark ${status.replace("_", " ")}`;
    btn.disabled = status === record.status;
    btn.addEventListener("click", () => onStatusChange(record, status));
    actions.appendChild(btn);
  }
  card.appendChild(actions);

  return card;
}

function wireAdminDashboard() {
  const recordsBox = document.getElementById("adminRecords");
  if (!recordsBox) return;

  if (!adminToken()) {
    window.location.replace("admin-login.html");
    return;
  }

  const filter = document.getElementById("statusFilter");

  const dashboardMessage = document.createElement("p");
  dashboardMessage.className = "form_message";
  recordsBox.parentNode.insertBefore(dashboardMessage, recordsBox);

  function showDashboardMessage(text) {
    dashboardMessage.textContent = text;
    dashboardMessage.style.color = "crimson";
  }

  async function changeStatus(record, status) {
    const type = record.record_type === "BOOKING" ? "booking" : "order";
    try {
      const response = await fetch(`${ADMIN_API_BASE}/api/admin/records/${type}/${record.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ status }),
      });
      if (response.status === 401) return adminLogout();
      const data = await response.json();
      await loadRecords();
      // Set the message after the reload — loadRecords clears it on success.
      if (!data.ok) showDashboardMessage(data.message || "Failed to update status.");
    } catch (error) {
      showDashboardMessage("Could not reach the server. Is it running?");
    }
  }

  async function loadRecords() {
    try {
      const status = filter ? filter.value : "ALL";
      const response = await fetch(`${ADMIN_API_BASE}/api/admin/records?status=${encodeURIComponent(status)}`, {
        headers: { Authorization: `Bearer ${adminToken()}` },
      });
      if (response.status === 401) return adminLogout();
      const data = await response.json();
      dashboardMessage.textContent = "";
      recordsBox.innerHTML = "";
      if (!data.ok || data.data.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No records found.";
        recordsBox.appendChild(empty);
        return;
      }
      data.data.forEach((record) => recordsBox.appendChild(recordCard(record, changeStatus)));
    } catch (error) {
      showDashboardMessage("Could not reach the server. Is it running?");
    }
  }

  if (filter) filter.addEventListener("change", loadRecords);
  const refresh = document.getElementById("refreshRecords");
  if (refresh) refresh.addEventListener("click", loadRecords);
  const logout = document.getElementById("adminLogout");
  if (logout) logout.addEventListener("click", adminLogout);

  loadRecords();
}

wireAdminLogin();
wireAdminDashboard();
