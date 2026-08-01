function reviewCard(review) {
  const card = document.createElement("div");
  card.className = "review_card";

  const text = document.createElement("div");
  text.className = "review_text";

  const name = document.createElement("h2");
  name.className = "name";
  name.textContent = review.customer_name;
  text.appendChild(name);

  const stars = document.createElement("div");
  stars.className = "review_icon";
  for (let i = 0; i < Number(review.rating); i++) {
    const star = document.createElement("i");
    star.className = "fa-solid fa-star";
    stars.appendChild(star);
  }
  text.appendChild(stars);

  const comment = document.createElement("p");
  comment.textContent = review.comment;
  text.appendChild(comment);

  card.appendChild(text);
  return card;
}

async function loadReviews() {
  const box = document.getElementById("latestReviews");
  if (!box) return;
  try {
    const response = await fetch(`${API_BASE}/api/reviews`);
    const data = await response.json();
    box.innerHTML = "";
    if (!data.ok || data.data.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No reviews yet. Be the first to write one!";
      box.appendChild(empty);
      return;
    }
    data.data.forEach((review) => box.appendChild(reviewCard(review)));
  } catch (error) {
    box.textContent = "Could not reach the server. Is it running?";
  }
}

function wireReviewForm() {
  const form = document.getElementById("reviewForm");
  if (!form) return;
  const message = document.getElementById("reviewMessage");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      message.textContent = data.message;
      message.style.color = data.ok ? "seagreen" : "crimson";
      if (data.ok) {
        form.reset();
        loadReviews();
      }
    } catch (error) {
      message.textContent = "Could not reach the server. Is it running?";
      message.style.color = "crimson";
    }
  });
}

wireReviewForm();
loadReviews();
