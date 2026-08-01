function showFormMessage(el, ok, text) {
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "seagreen" : "crimson";
}

function wireForm(formId, messageId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;
  const message = document.getElementById(messageId);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      showFormMessage(message, data.ok, data.message);
      if (data.ok) form.reset();
    } catch (error) {
      showFormMessage(message, false, "Could not reach the server. Is it running?");
    }
  });
}

wireForm("deliveryForm", "deliveryMessage", "/api/orders/delivery");
wireForm("takeawayForm", "takeawayMessage", "/api/orders/takeaway");
wireForm("bookingForm", "bookingMessage", "/api/bookings");
