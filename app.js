const books = [
  { id: "midnight-library", title: "The Midnight Library", author: "Matt Haig", category: "Fiction", price: 16.99, isbn: "9780525559474", badge: "Bestseller", color: "#d9d4c8" },
  { id: "educated", title: "Educated", author: "Tara Westover", category: "Memoir", price: 18.50, isbn: "9780399590504", badge: "Reader favorite", color: "#d4c5a9" },
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", category: "Self-growth", price: 21.00, isbn: "9780735211292", badge: "Bestseller", color: "#d9e0db" },
  { id: "normal-people", title: "Normal People", author: "Sally Rooney", category: "Fiction", price: 15.25, isbn: "9781984822178", badge: "", color: "#d5d9d9" },
  { id: "sapiens", title: "Sapiens", author: "Yuval Noah Harari", category: "History", price: 19.99, isbn: "9780062316097", badge: "", color: "#e5d7c6" },
  { id: "little-life", title: "A Little Life", author: "Hanya Yanagihara", category: "Fiction", price: 17.75, isbn: "9780804172707", badge: "", color: "#d9d7e2" },
  { id: "design-everyday", title: "The Design of Everyday Things", author: "Don Norman", category: "Design", price: 24.00, isbn: "9780465050659", badge: "Staff pick", color: "#e7d8c8" },
  { id: "fourth-wing", title: "Fourth Wing", author: "Rebecca Yarros", category: "Fantasy", price: 22.50, isbn: "9781649374042", badge: "Trending", color: "#d7c9bd" }
];

const page = document.body.dataset.page || "home";
const app = document.querySelector("#app");
const money = (amount) => `$${amount.toFixed(2)}`;
const cover = (book, size = "L") => `https://covers.openlibrary.org/b/isbn/${book.isbn}-${size}.jpg`;

function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem("bookverse-cart") || "[]");
    return Array.isArray(stored) ? stored.filter((item) => books.some((book) => book.id === item.id) && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("bookverse-cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => { element.textContent = count; });
}

function header() {
  const nav = [["Home", "index.html", "home"], ["Books", "books.html", "books"], ["Search", "search.html", "search"]];
  const query = new URLSearchParams(location.search).get("q") || "";
  return `<div class="announcement">A little something for your next chapter — free shipping over $40</div>
    <header class="site-header"><div class="header-inner">
      <a class="brand" href="index.html" aria-label="BookVerse home"><span class="brand-mark">B</span>BookVerse</a>
      <nav class="main-nav" aria-label="Main navigation">${nav.map(([label, href, key]) => `<a href="${href}" class="${page === key ? "active" : ""}">${label}</a>`).join("")}</nav>
      <form class="header-search" action="search.html" role="search"><input type="search" name="q" placeholder="Find your next read..." value="${escapeHtml(query)}" aria-label="Search books"><button aria-label="Submit search">⌕</button></form>
      <div class="header-actions"><a class="icon-link mobile-search" href="search.html" aria-label="Search">⌕</a><a class="icon-link" href="login.html" aria-label="Log in">♙</a><a class="icon-link" href="cart.html" aria-label="Shopping bag">♧<span class="cart-count" data-cart-count>0</span></a></div>
    </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid">
    <div class="footer-brand"><a class="brand" href="index.html"><span class="brand-mark">B</span>BookVerse</a><p>A cozy corner of the internet for curious minds and well-loved stories.</p></div>
    <div class="footer-column"><h3>Explore</h3><a href="books.html">All books</a><a href="search.html">Find a book</a><a href="books.html?category=Fiction">Fiction</a></div>
    <div class="footer-column"><h3>Your account</h3><a href="login.html">Log in</a><a href="signup.html">Create account</a><a href="cart.html">Shopping bag</a></div>
    <div class="footer-column"><h3>Here to help</h3><a href="checkout.html">Checkout</a><a href="mailto:hello@bookverse.example">Contact us</a><a href="index.html#newsletter">Bookish notes</a></div>
  </div><div class="footer-bottom">© 2025 BookVerse. Made for the love of a good story.</div></div></footer>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function bookCard(book) {
  return `<article class="book-card"><div class="cover-wrap" style="--cover-bg:${book.color}">${book.badge ? `<span class="badge">${book.badge}</span>` : ""}<img src="${cover(book)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" onerror="this.style.visibility='hidden'"></div>
    <div class="book-info"><p class="book-category">${escapeHtml(book.category)}</p><h3 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3><p class="book-author">by ${escapeHtml(book.author)}</p>
    <div class="book-bottom"><span class="price">${money(book.price)}</span><button class="button small" data-add="${book.id}">＋ Add to bag</button></div></div></article>`;
}

function homePage() {
  return `<main>
    <section class="hero"><div class="hero-content"><p class="eyebrow">Your next chapter starts here</p><h1>Stories worth<br>staying in for.</h1><p class="hero-copy">Thoughtful reads, handpicked for curious minds. Find the book you didn't know you were looking for.</p><a class="button" href="books.html">Explore the collection <span>→</span></a></div></section>
    <div class="container"><div class="benefits"><div class="benefit"><span class="benefit-icon">✳</span> Carefully picked, always</div><div class="benefit"><span class="benefit-icon">♡</span> A small shop with a big heart</div><div class="benefit"><span class="benefit-icon">↗</span> Free shipping on orders over $40</div></div></div>
    <section class="section"><div class="container"><div class="section-heading"><div><p class="eyebrow">A few good pages</p><h2>Readers are loving</h2><p>Stories making their way onto nightstands everywhere.</p></div><a class="text-link" href="books.html">See all books →</a></div><div class="book-grid">${books.slice(0, 4).map(bookCard).join("")}</div></div></section>
    <section class="section soft"><div class="container"><div class="section-heading"><div><p class="eyebrow">Follow your curiosity</p><h2>Find your kind of story</h2></div></div><div class="category-row">${["Fiction", "Memoir", "Self-growth", "History", "Design", "Fantasy"].map((category) => `<a class="category-chip" href="books.html?category=${encodeURIComponent(category)}">${category} &nbsp;→</a>`).join("")}</div></div></section>
    <section class="section"><div class="container"><div class="newsletter" id="newsletter"><div><p class="eyebrow">A note from our bookshelves</p><h2>Good books. No clutter.</h2><p>Get our occasional reading list, new arrivals, and little bookish joys.</p></div><form class="newsletter-form" data-newsletter><input type="email" placeholder="Your email address" aria-label="Your email address" required><button class="button small">Count me in</button></form></div></div></section>
  </main>`;
}

function catalogPage(isSearch = false) {
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  const categories = [...new Set(books.map((book) => book.category))];
  const title = isSearch ? "Find your next favorite" : "The Bookshelf";
  return `<main class="page-main"><div class="container"><div class="page-heading"><p class="eyebrow">${isSearch ? "A universe of good reads" : "A little something for every reader"}</p><h1>${title}</h1></div>
    ${isSearch ? `<form class="header-search mobile-search-form" action="search.html" style="display:flex;max-width:100%;height:46px;margin:0 0 20px"><input type="search" name="q" placeholder="Try a title, author, or genre..." value="${escapeHtml(initialQuery)}" aria-label="Search books"><button aria-label="Submit search">⌕</button></form>` : ""}
    <div class="toolbar"><div class="toolbar-controls"><select class="control" id="category-filter" aria-label="Filter by category"><option value="">All categories</option>${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}</select><select class="control" id="sort-books" aria-label="Sort books"><option value="featured">Featured</option><option value="title">Title: A to Z</option><option value="price-low">Price: Low to high</option><option value="price-high">Price: High to low</option></select></div><span class="results-count" id="results-count"></span></div>
    <div class="book-grid" id="catalog-grid"></div></div></main>`;
}

function authPage(isSignup) {
  return `<main class="auth-layout"><section class="auth-aside"><div><p class="eyebrow">A world of stories awaits</p><h1>${isSignup ? "Make room for more stories." : "Welcome back, book lover."}</h1><p>${isSignup ? "Create your little corner of BookVerse. Keep your reading list close and discover something wonderful." : "Your next favorite read is just around the corner. Pick up where your bookish journey left off."}</p><p class="aside-note">“A book is a dream that you hold in your hands.”</p></div></section>
    <section class="auth-panel"><form class="auth-form" data-auth="${isSignup ? "signup" : "login"}"><h2>${isSignup ? "Join BookVerse" : "Log in"}</h2><p class="form-intro">${isSignup ? "It only takes a moment to get started." : "Good to have you back."}</p>
      ${isSignup ? `<div class="form-field"><label for="name">Your name</label><input id="name" name="name" autocomplete="name" required placeholder="Jamie Reader"></div>` : ""}
      <div class="form-field"><label for="email">Email address</label><input id="email" type="email" name="email" autocomplete="email" required placeholder="you@example.com"></div>
      <div class="form-field"><label for="password">Password</label><input id="password" type="password" name="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="6" required placeholder="At least 6 characters"></div>
      <button class="button">${isSignup ? "Create my account" : "Log in to my account"} <span>→</span></button><p class="form-message" aria-live="polite"></p>
      <p class="auth-switch">${isSignup ? "Already have an account?" : "New to BookVerse?"} <a class="text-link" href="${isSignup ? "login.html" : "signup.html"}">${isSignup ? "Log in" : "Create an account"}</a></p>
    </form></section></main>`;
}

function cartPage() {
  return `<main class="page-main"><div class="container"><div class="page-heading"><p class="eyebrow">Your bookish picks</p><h1>Your shopping bag</h1></div><div id="cart-content"></div></div></main>`;
}

function checkoutPage() {
  return `<main class="page-main"><div class="container"><div class="page-heading"><p class="eyebrow">One last step</p><h1>Checkout</h1></div><div id="checkout-content"></div></div></main>`;
}

app.innerHTML = `${header()}${page === "home" ? homePage() : page === "books" ? catalogPage() : page === "search" ? catalogPage(true) : page === "login" ? authPage(false) : page === "signup" ? authPage(true) : page === "cart" ? cartPage() : checkoutPage()}${footer()}`;
updateCartCount();

function formatCart(cart) {
  return cart.map((item) => ({ ...books.find((book) => book.id === item.id), quantity: item.quantity })).filter((book) => book.id);
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

if (page === "books" || page === "search") {
  const categoryFromUrl = new URLSearchParams(location.search).get("category");
  if (categoryFromUrl && [...document.querySelector("#category-filter").options].some((option) => option.value === categoryFromUrl)) {
    document.querySelector("#category-filter").value = categoryFromUrl;
  }
  document.querySelector("#category-filter").addEventListener("change", renderCatalog);
  document.querySelector("#sort-books").addEventListener("change", renderCatalog);
  renderCatalog();
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

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) {
    const cart = getCart();
    const existing = cart.find((item) => item.id === addButton.dataset.add);
    if (existing) existing.quantity += 1;
    else cart.push({ id: addButton.dataset.add, quantity: 1 });
    saveCart(cart);
    showToast(`${books.find((book) => book.id === addButton.dataset.add).title} added to your bag`);
  }

  const quantityButton = event.target.closest("[data-step]");
  const removeButton = event.target.closest("[data-remove]");
  if (quantityButton || removeButton) {
    const id = quantityButton ? quantityButton.dataset.id : removeButton.dataset.remove;
    let cart = getCart();
    if (removeButton) cart = cart.filter((item) => item.id !== id);
    else {
      const item = cart.find((entry) => entry.id === id);
      if (item) item.quantity += Number(quantityButton.dataset.step);
      cart = cart.filter((entry) => entry.quantity > 0);
    }
    saveCart(cart);
    renderCart();
  }
});

function totals(cart) {
  const subtotal = cart.reduce((sum, book) => sum + book.price * book.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 40 ? 0 : 4.95;
  return { subtotal, shipping, total: subtotal + shipping };
}

function renderCart() {
  const target = document.querySelector("#cart-content");
  if (!target) return;
  const cart = formatCart(getCart());
  if (!cart.length) {
    target.innerHTML = `<div class="empty-state"><h2>Your next great read is waiting</h2><p>Your bag is taking a little breather. Let's find it something good.</p><a class="button" href="books.html">Browse the bookshelf →</a></div>`;
    return;
  }
  const amount = totals(cart);
  target.innerHTML = `<div class="cart-layout"><div class="cart-list">${cart.map((book) => `<article class="cart-item"><img src="${cover(book, "M")}" alt="Cover of ${escapeHtml(book.title)}"><div><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.author)}</p><div class="quantity"><button aria-label="Decrease quantity of ${escapeHtml(book.title)}" data-step="-1" data-id="${book.id}">−</button><span>${book.quantity}</span><button aria-label="Increase quantity of ${escapeHtml(book.title)}" data-step="1" data-id="${book.id}">＋</button></div></div><div class="item-price"><strong>${money(book.price * book.quantity)}</strong><br><button class="remove-item" data-remove="${book.id}">Remove</button></div></article>`).join("")}</div>
    <aside class="summary-card"><h2>Order summary</h2><div class="summary-row"><span>Subtotal</span><span>${money(amount.subtotal)}</span></div><div class="summary-row"><span>Shipping</span><span>${amount.shipping ? money(amount.shipping) : "Free"}</span></div><div class="summary-row summary-total"><span>Total</span><span>${money(amount.total)}</span></div><a class="button" href="checkout.html">Continue to checkout →</a><p class="summary-note">Free shipping on orders over $40</p></aside></div>`;
}

function renderCheckout() {
  const target = document.querySelector("#checkout-content");
  if (!target) return;
  const cart = formatCart(getCart());
  if (!cart.length) {
    target.innerHTML = `<div class="empty-state"><h2>Your bag is empty</h2><p>Add a book or two before heading to checkout.</p><a class="button" href="books.html">Browse books →</a></div>`;
    return;
  }
  const amount = totals(cart);
  target.innerHTML = `<div class="checkout-layout"><form class="checkout-form" id="place-order"><fieldset><legend>Where should we send your books?</legend><div class="form-grid">
      <div class="form-field"><label for="checkout-name">Full name</label><input id="checkout-name" name="name" autocomplete="name" required></div>
      <div class="form-field"><label for="checkout-email">Email address</label><input id="checkout-email" type="email" name="email" autocomplete="email" required></div>
      <div class="form-field full"><label for="address">Street address</label><input id="address" name="address" autocomplete="street-address" required></div>
      <div class="form-field"><label for="city">City</label><input id="city" name="city" autocomplete="address-level2" required></div>
      <div class="form-field"><label for="postal">Postal code</label><input id="postal" name="postal" autocomplete="postal-code" required></div>
    </div></fieldset><button class="button">Place your order · ${money(amount.total)} →</button><p class="form-message" aria-live="polite"></p></form>
    <aside class="summary-card"><h2>Your order</h2>${cart.map((book) => `<div class="checkout-item"><img src="${cover(book, "S")}" alt=""><span>${escapeHtml(book.title)} × ${book.quantity}</span><strong>${money(book.price * book.quantity)}</strong></div>`).join("")}<div class="summary-row"><span>Subtotal</span><span>${money(amount.subtotal)}</span></div><div class="summary-row"><span>Shipping</span><span>${amount.shipping ? money(amount.shipping) : "Free"}</span></div><div class="summary-row summary-total"><span>Total</span><span>${money(amount.total)}</span></div><p class="summary-note">Demo checkout — no payment is collected.</p></aside></div>`;
  document.querySelector("#place-order").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const name = new FormData(event.currentTarget).get("name");
    saveCart([]);
    target.innerHTML = `<section class="success-panel"><div class="success-icon">✓</div><p class="eyebrow">A new chapter begins</p><h1>Thank you, ${escapeHtml(name)}!</h1><p>Your demo order has been placed. We can't wait for these stories to find their way to you.</p><a class="button" href="books.html">Keep exploring →</a></section>`;
  });
}

renderCart();
renderCheckout();

document.querySelectorAll("[data-auth]").forEach((form) => form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  form.querySelector(".form-message").textContent = form.dataset.auth === "signup"
    ? "Your demo account is ready! Backend account creation can be connected here."
    : "You're signed in for this demo. Connect your authentication service here.";
}));

document.querySelectorAll("[data-newsletter]").forEach((form) => form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  form.innerHTML = `<p class="form-message" role="status">You're on the list — see you in your inbox.</p>`;
}));
