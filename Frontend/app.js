const config = window.BOOKVERSE_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const tokenKey = "bookverse-access-token";
const requestedPage = document.body.dataset.page || "home";
const protectedPages = ["home", "books", "search", "cart", "checkout"];
const app = document.querySelector("#app");
const money = (amount) => `$${Number(amount).toFixed(2)}`;
const cover = (book, size = "L") => `https://covers.openlibrary.org/b/isbn/${book.isbn}-${size}.jpg`;
let page = requestedPage;
let currentUser = null;
let books = [];
let cart = { items: [], count: 0, subtotal: 0, shipping: 0, total: 0 };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function getToken() {
  return localStorage.getItem(tokenKey);
}

function loginUrl(destination) {
  return `login.html?next=${encodeURIComponent(destination)}`;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (getToken()) headers.set("Authorization", `Bearer ${getToken()}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.detail || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function header() {
  const nav = [["Home", "index.html", "home"], ["Books", "books.html", "books"], ["Search", "search.html", "search"]];
  const query = new URLSearchParams(location.search).get("q") || "";
  const accountLinks = currentUser
    ? `<span class="account-link">Hi, ${escapeHtml(currentUser.name.split(" ")[0])}</span><a class="account-link" href="logout.html">Log out</a><a class="icon-link" href="cart.html" aria-label="Shopping bag">♧<span class="cart-count" data-cart-count>${cart.count}</span></a>`
    : `<a class="account-link" href="login.html">Log in</a><a class="account-link" href="signup.html">Sign up</a>`;
  return `<div class="announcement">A little something for your next chapter — free shipping over $40</div>
    <header class="site-header"><div class="header-inner">
      <a class="brand" href="index.html" aria-label="BookVerse home"><span class="brand-mark">B</span>BookVerse</a>
      <nav class="main-nav" aria-label="Main navigation">${nav.map(([label, href, key]) => `<a href="${href}" class="${page === key ? "active" : ""}">${label}</a>`).join("")}</nav>
      <form class="header-search" action="search.html" role="search"><input type="search" name="q" placeholder="Find your next read..." value="${escapeHtml(query)}" aria-label="Search books"><button aria-label="Submit search">⌕</button></form>
      <div class="header-actions"><a class="icon-link mobile-search" href="search.html" aria-label="Search">⌕</a>${accountLinks}</div>
    </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid">
    <div class="footer-brand"><a class="brand" href="index.html"><span class="brand-mark">B</span>BookVerse</a><p>A cozy corner of the internet for curious minds and well-loved stories.</p></div>
    <div class="footer-column"><h3>Explore</h3><a href="books.html">All books</a><a href="search.html">Find a book</a><a href="books.html?category=Fiction">Fiction</a></div>
    <div class="footer-column"><h3>Your account</h3>${currentUser ? `<a href="logout.html">Log out</a><a href="cart.html">Shopping bag</a>` : `<a href="login.html">Log in</a><a href="signup.html">Create account</a>`}</div>
    <div class="footer-column"><h3>Here to help</h3><a href="checkout.html">Checkout</a><a href="mailto:hello@bookverse.example">Contact us</a><a href="index.html#newsletter">Bookish notes</a></div>
  </div><div class="footer-bottom">© 2025 BookVerse. Made for the love of a good story.</div></div></footer>`;
}

function bookCard(book) {
  return `<article class="book-card"><div class="cover-wrap" style="--cover-bg:${escapeHtml(book.color || "#e8e1d6")}">${book.badge ? `<span class="badge">${escapeHtml(book.badge)}</span>` : ""}<img src="${cover(book)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" onerror="this.style.visibility='hidden'"></div>
    <div class="book-info"><p class="book-category">${escapeHtml(book.category)}</p><h3 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3><p class="book-author">by ${escapeHtml(book.author)}</p>
    <div class="book-bottom"><span class="price">${money(book.price)}</span><button class="button small" data-add="${escapeHtml(book.id)}">＋ Add to bag</button></div></div></article>`;
}

function homePage() {
  return `<main>
    <section class="hero"><div class="hero-content"><p class="eyebrow">Your next chapter starts here</p><h1>Stories worth<br>staying in for.</h1><p class="hero-copy">Thoughtful reads, handpicked for curious minds. Find the book you didn't know you were looking for.</p><a class="button" href="books.html">Explore the collection <span>→</span></a></div></section>
    <div class="container"><div class="benefits"><div class="benefit"><span class="benefit-icon">✳</span> Carefully picked, always</div><div class="benefit"><span class="benefit-icon">♡</span> A small shop with a big heart</div><div class="benefit"><span class="benefit-icon">↗</span> Free shipping on orders over $40</div></div></div>
    <section class="section"><div class="container"><div class="section-heading"><div><p class="eyebrow">A few good pages</p><h2>Readers are loving</h2><p>Stories making their way onto nightstands everywhere.</p></div><a class="text-link" href="books.html">See all books →</a></div><div class="book-grid">${books.slice(0, 4).map(bookCard).join("")}</div></div></section>
    <section class="section soft"><div class="container"><div class="section-heading"><div><p class="eyebrow">Follow your curiosity</p><h2>Find your kind of story</h2></div></div><div class="category-row">${[...new Set(books.map((book) => book.category))].map((category) => `<a class="category-chip" href="books.html?category=${encodeURIComponent(category)}">${escapeHtml(category)} &nbsp;→</a>`).join("")}</div></div></section>
    <section class="section"><div class="container"><div class="newsletter" id="newsletter"><div><p class="eyebrow">A note from our bookshelves</p><h2>Good books. No clutter.</h2><p>Get our occasional reading list, new arrivals, and little bookish joys.</p></div><form class="newsletter-form" data-newsletter><input type="email" placeholder="Your email address" aria-label="Your email address" required><button class="button small">Count me in</button></form></div></div></section>
  </main>`;
}

function catalogPage(isSearch = false) {
  const categories = [...new Set(books.map((book) => book.category))];
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  return `<main class="page-main"><div class="container"><div class="page-heading"><p class="eyebrow">${isSearch ? "A universe of good reads" : "A little something for every reader"}</p><h1>${isSearch ? "Find your next favorite" : "The Bookshelf"}</h1></div>
    ${isSearch ? `<form class="header-search mobile-search-form" action="search.html" style="display:flex;max-width:100%;height:46px;margin:0 0 20px"><input type="search" name="q" placeholder="Try a title, author, or genre..." value="${escapeHtml(initialQuery)}" aria-label="Search books"><button aria-label="Submit search">⌕</button></form>` : ""}
    <div class="toolbar"><div class="toolbar-controls"><select class="control" id="category-filter" aria-label="Filter by category"><option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select><select class="control" id="sort-books" aria-label="Sort books"><option value="featured">Featured</option><option value="title">Title: A to Z</option><option value="price-low">Price: Low to high</option><option value="price-high">Price: High to low</option></select></div><span class="results-count" id="results-count"></span></div>
    <div class="book-grid" id="catalog-grid"></div></div></main>`;
}

function authPage(isSignup) {
  const next = new URLSearchParams(location.search).get("next");
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  const demo = !isSignup && config.demoLogin
    ? `<div class="demo-credentials"><strong>Local demo login</strong><span>Email: <code>${escapeHtml(config.demoLogin.email)}</code></span><span>Password: <code>${escapeHtml(config.demoLogin.password)}</code></span><small>Development only. Do not publish demo credentials.</small></div>`
    : "";
  return `<main class="auth-layout"><section class="auth-aside"><div><p class="eyebrow">A world of stories awaits</p><h1>${isSignup ? "Make room for more stories." : "Welcome back, book lover."}</h1><p>${isSignup ? "Create your little corner of BookVerse. Keep your reading list close and discover something wonderful." : "Your next favorite read is just around the corner. Pick up where your bookish journey left off."}</p><p class="aside-note">“A book is a dream that you hold in your hands.”</p></div></section>
    <section class="auth-panel"><form class="auth-form" data-auth="${isSignup ? "signup" : "login"}"><h2>${isSignup ? "Join BookVerse" : "Log in"}</h2><p class="form-intro">${isSignup ? "It only takes a moment to get started." : "Good to have you back."}</p>${demo}
      ${isSignup ? `<div class="form-field"><label for="name">Your name</label><input id="name" name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="Jamie Reader"></div>` : ""}
      <div class="form-field"><label for="email">Email address</label><input id="email" type="email" name="email" autocomplete="email" required placeholder="you@example.com" ${isSignup || !config.demoLogin ? "" : `value="${escapeHtml(config.demoLogin.email)}"`}></div>
      <div class="form-field"><label for="password">Password</label><input id="password" type="password" name="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="${isSignup ? "8" : "1"}" maxlength="128" required placeholder="${isSignup ? "At least 8 characters" : "Your password"}" ${isSignup || !config.demoLogin ? "" : `value="${escapeHtml(config.demoLogin.password)}"`}></div>
      <button class="button">${isSignup ? "Create my account" : "Log in to my account"} <span>→</span></button><p class="form-message" aria-live="polite"></p>
      <p class="auth-switch">${isSignup ? "Already have an account?" : "New to BookVerse?"} <a class="text-link" href="${isSignup ? `login.html${nextQuery}` : `signup.html${nextQuery}`}">${isSignup ? "Log in" : "Create an account"}</a></p>
    </form></section></main>`;
}

function cartPage() {
  return `<main class="page-main"><div class="container"><div class="page-heading"><p class="eyebrow">Your bookish picks</p><h1>Your shopping bag</h1></div><div id="cart-content"></div></div></main>`;
}

function checkoutPage() {
  return `<main class="page-main"><div class="container"><div class="page-heading"><p class="eyebrow">One last step</p><h1>Checkout</h1></div><div id="checkout-content"></div></div></main>`;
}

function logoutPage() {
  return `<main class="page-main"><div class="container"><section class="success-panel"><div class="success-icon">✓</div><p class="eyebrow">Until your next chapter</p><h1>You've logged out</h1><p>Your session has ended. Sign in again whenever you're ready to browse.</p><a class="button" href="login.html">Back to login →</a></section></div></main>`;
}

function renderError(error) {
  app.innerHTML = `${header()}<main class="page-main"><div class="container"><section class="empty-state"><h2>We couldn't connect to BookVerse</h2><p>${escapeHtml(error.message)} Check that the backend is running and the API URL in config.js is correct.</p><button class="button" data-retry>Try again</button></section></div></main>${footer()}`;
}

function renderApp() {
  const content = page === "home" ? homePage()
    : page === "books" ? catalogPage()
      : page === "search" ? catalogPage(true)
        : page === "login" ? authPage(false)
          : page === "signup" ? authPage(true)
            : page === "logout" ? logoutPage()
              : page === "cart" ? cartPage()
                : checkoutPage();
  app.innerHTML = `${header()}${content}${footer()}`;
  if (page === "books" || page === "search") {
    const categoryFromUrl = new URLSearchParams(location.search).get("category");
    const categoryFilter = document.querySelector("#category-filter");
    if ([...categoryFilter.options].some((option) => option.value === categoryFromUrl)) categoryFilter.value = categoryFromUrl;
    categoryFilter.addEventListener("change", renderCatalog);
    document.querySelector("#sort-books").addEventListener("change", renderCatalog);
    renderCatalog();
  }
  if (page === "cart") renderCart();
  if (page === "checkout") renderCheckout();
  bindForms();
}

function renderCatalog() {
  const grid = document.querySelector("#catalog-grid");
  if (!grid) return;
  const category = document.querySelector("#category-filter").value;
  const sort = document.querySelector("#sort-books").value;
  const query = (new URLSearchParams(location.search).get("q") || "").trim().toLowerCase();
  let matches = books.filter((book) => (!category || book.category === category) && (!query || `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query)));
  if (sort === "title") matches = [...matches].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "price-low") matches = [...matches].sort((a, b) => a.price - b.price);
  if (sort === "price-high") matches = [...matches].sort((a, b) => b.price - a.price);
  document.querySelector("#results-count").textContent = `${matches.length} ${matches.length === 1 ? "book" : "books"}${query ? ` for “${query}”` : ""}`;
  grid.innerHTML = matches.length ? matches.map(bookCard).join("") : `<div class="empty-state" style="grid-column:1/-1"><h2>No books found just yet</h2><p>Try another title or category — the right story is out there.</p><a class="button small" href="books.html">Browse all books</a></div>`;
}

function renderCart() {
  const target = document.querySelector("#cart-content");
  if (!target) return;
  if (!cart.items.length) {
    target.innerHTML = `<div class="empty-state"><h2>Your next great read is waiting</h2><p>Your bag is taking a little breather. Let's find it something good.</p><a class="button" href="books.html">Browse the bookshelf →</a></div>`;
    return;
  }
  target.innerHTML = `<div class="cart-layout"><div class="cart-list">${cart.items.map((book) => `<article class="cart-item"><img src="${cover(book, "M")}" alt="Cover of ${escapeHtml(book.title)}"><div><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.author)}</p><div class="quantity"><button aria-label="Decrease quantity of ${escapeHtml(book.title)}" data-step="-1" data-id="${escapeHtml(book.id)}">−</button><span>${book.quantity}</span><button aria-label="Increase quantity of ${escapeHtml(book.title)}" data-step="1" data-id="${escapeHtml(book.id)}">＋</button></div></div><div class="item-price"><strong>${money(book.line_total)}</strong><br><button class="remove-item" data-remove="${escapeHtml(book.id)}">Remove</button></div></article>`).join("")}</div>
    <aside class="summary-card"><h2>Order summary</h2><div class="summary-row"><span>Subtotal</span><span>${money(cart.subtotal)}</span></div><div class="summary-row"><span>Shipping</span><span>${cart.shipping ? money(cart.shipping) : "Free"}</span></div><div class="summary-row summary-total"><span>Total</span><span>${money(cart.total)}</span></div><a class="button" href="checkout.html">Continue to checkout →</a><p class="summary-note">Free shipping on orders over $40</p></aside></div>`;
}

function renderCheckout() {
  const target = document.querySelector("#checkout-content");
  if (!target) return;
  if (!cart.items.length) {
    target.innerHTML = `<div class="empty-state"><h2>Your bag is empty</h2><p>Add a book or two before heading to checkout.</p><a class="button" href="books.html">Browse books →</a></div>`;
    return;
  }
  target.innerHTML = `<div class="checkout-layout"><form class="checkout-form" id="place-order"><fieldset><legend>Where should we send your books?</legend><div class="form-grid">
      <div class="form-field"><label for="checkout-name">Full name</label><input id="checkout-name" name="name" autocomplete="name" required minlength="2"></div>
      <div class="form-field"><label for="checkout-email">Email address</label><input id="checkout-email" type="email" name="email" autocomplete="email" required value="${escapeHtml(currentUser.email)}"></div>
      <div class="form-field full"><label for="address">Street address</label><input id="address" name="address" autocomplete="street-address" required minlength="5"></div>
      <div class="form-field"><label for="city">City</label><input id="city" name="city" autocomplete="address-level2" required minlength="2"></div>
      <div class="form-field"><label for="postal">Postal code</label><input id="postal" name="postal_code" autocomplete="postal-code" required minlength="2"></div>
    </div></fieldset><button class="button">Place your order · ${money(cart.total)} →</button><p class="form-message" aria-live="polite"></p></form>
    <aside class="summary-card"><h2>Your order</h2>${cart.items.map((book) => `<div class="checkout-item"><img src="${cover(book, "S")}" alt=""><span>${escapeHtml(book.title)} × ${book.quantity}</span><strong>${money(book.line_total)}</strong></div>`).join("")}<div class="summary-row"><span>Subtotal</span><span>${money(cart.subtotal)}</span></div><div class="summary-row"><span>Shipping</span><span>${cart.shipping ? money(cart.shipping) : "Free"}</span></div><div class="summary-row summary-total"><span>Total</span><span>${money(cart.total)}</span></div></aside></div>`;
}

function showMessage(form, message, isError = false) {
  const target = form.querySelector(".form-message");
  target.textContent = message;
  target.classList.toggle("error", isError);
}

function destinationAfterLogin() {
  const next = new URLSearchParams(location.search).get("next");
  const allowed = ["index.html", "books.html", "search.html", "cart.html", "checkout.html"];
  if (!next) return "index.html";
  const url = new URL(next, location.href);
  const name = url.pathname.split("/").pop();
  return url.origin === location.origin && allowed.includes(name) ? `${name}${url.search}` : "index.html";
}

function bindForms() {
  document.querySelectorAll("[data-auth]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const endpoint = form.dataset.auth === "signup" ? "/auth/signup" : "/auth/login";
    try {
      const result = await api(endpoint, { method: "POST", body: JSON.stringify(values) });
      localStorage.setItem(tokenKey, result.access_token);
      location.replace(destinationAfterLogin());
    } catch (error) {
      showMessage(form, error.message, true);
    }
  }));

  document.querySelector("#place-order")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    try {
      const order = await api("/orders", { method: "POST", body: JSON.stringify(values) });
      cart = { items: [], count: 0, subtotal: 0, shipping: 0, total: 0 };
      document.querySelector("#checkout-content").innerHTML = `<section class="success-panel"><div class="success-icon">✓</div><p class="eyebrow">A new chapter begins</p><h1>Thank you, ${escapeHtml(values.name)}!</h1><p>Your order ${escapeHtml(order.order_id)} has been placed.</p><a class="button" href="books.html">Keep exploring →</a></section>`;
      updateCartCount();
    } catch (error) {
      showMessage(form, error.message, true);
    }
  });

  document.querySelectorAll("[data-newsletter]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    form.innerHTML = `<p class="form-message" role="status">Thanks! Newsletter signup will be connected to the backend next.</p>`;
  }));

  document.querySelector("[data-retry]")?.addEventListener("click", initialize);
}

function updateCartCount() {
  document.querySelectorAll("[data-cart-count]").forEach((element) => { element.textContent = cart.count; });
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2600);
}

async function refreshCart() {
  cart = await api("/cart");
  updateCartCount();
}

async function updateCartItem(bookId, change) {
  if (change > 0) {
    cart = await api(`/cart/items/${encodeURIComponent(bookId)}`, {
      method: "POST",
      body: JSON.stringify({ quantity: change }),
    });
  } else {
    const item = cart.items.find((entry) => entry.id === bookId);
    if (item && item.quantity + change > 0) {
      const items = cart.items.map((entry) => ({
        book_id: entry.id,
        quantity: entry.id === bookId ? entry.quantity + change : entry.quantity,
      }));
      cart = await api("/cart", { method: "PUT", body: JSON.stringify({ items }) });
    } else {
      cart = await api(`/cart/items/${encodeURIComponent(bookId)}`, { method: "DELETE" });
    }
  }
  updateCartCount();
  renderCart();
}

document.addEventListener("click", async (event) => {
  const addButton = event.target.closest("[data-add]");
  const stepButton = event.target.closest("[data-step]");
  const removeButton = event.target.closest("[data-remove]");
  try {
    if (addButton) {
      cart = await api(`/cart/items/${encodeURIComponent(addButton.dataset.add)}`, {
        method: "POST",
        body: JSON.stringify({ quantity: 1 }),
      });
      updateCartCount();
      showToast(`${books.find((book) => book.id === addButton.dataset.add)?.title || "Book"} added to your bag`);
    }
    if (stepButton) await updateCartItem(stepButton.dataset.id, Number(stepButton.dataset.step));
    if (removeButton) {
      cart = await api(`/cart/items/${encodeURIComponent(removeButton.dataset.remove)}`, { method: "DELETE" });
      updateCartCount();
      renderCart();
    }
  } catch (error) {
    showToast(error.message);
  }
});

async function initialize() {
  const token = getToken();
  if (requestedPage === "logout") {
    localStorage.removeItem(tokenKey);
    currentUser = null;
    page = "logout";
    renderApp();
    return;
  }
  if (protectedPages.includes(requestedPage) && !token) {
    location.replace(loginUrl(`${location.pathname.split("/").pop()}${location.search}`));
    return;
  }
  try {
    if (token) currentUser = await api("/auth/me");
    if (protectedPages.includes(requestedPage)) {
      books = await api("/books", { headers: { Accept: "application/json" } });
      await refreshCart();
    }
    page = requestedPage;
    renderApp();
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem(tokenKey);
      if (protectedPages.includes(requestedPage)) {
        location.replace(loginUrl(`${location.pathname.split("/").pop()}${location.search}`));
        return;
      }
      currentUser = null;
      page = requestedPage;
      renderApp();
      return;
    }
    renderError(error);
  }
}

initialize();
