const config = window.BOOKVERSE_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "https://bookverse-2yw0.onrender.com/api").replace(/\/$/, "");
const tokenKey = "bookverse-access-token";
const demoSubscriptionKey = "bookverse-demo-subscription";
const requestedPage = document.body.dataset.page || "home";
const protectedPages = ["home", "books", "search", "cart", "checkout"];
const app = document.querySelector("#app");
const money = (amount) => `$${Number(amount).toFixed(2)}`;
const cover = (book, size = "L") => `https://covers.openlibrary.org/b/isbn/${book.isbn}-${size}.jpg`;
const previewPages = {
  "midnight-library": [
    { heading: "The room between choices", text: "At the end of a long evening, Mara finds a quiet room whose shelves seem to hold more than books. Each spine carries a question she once left unanswered. She chooses one at random, not because she expects a miracle, but because standing still has become harder than taking a chance." },
    { heading: "A different kind of beginning", text: "The first story she opens is familiar and strange at once: a small decision, made years ago, has led to a life she never pictured. Mara notices the ordinary details first—the kettle cooling, rain on the windowsill, a message she almost sent. Perhaps a life is not one perfect answer, but a collection of brave next steps." },
  ],
  educated: [
    { heading: "Learning to name the world", text: "On a hillside far from a classroom, a young student begins collecting questions. The mountain weather sets the schedule, family stories shape the rules, and a borrowed book becomes a window. Every new idea brings excitement, but also the difficult work of deciding what to keep and what to reconsider." },
    { heading: "The first open door", text: "A lecture hall feels like another country: unfamiliar customs, new language, and people who seem certain they belong. The student takes careful notes and listens twice. Slowly, knowledge becomes more than facts. It offers a way to look back at home with honesty, tenderness, and a clearer sense of self." },
  ],
  "atomic-habits": [
    { heading: "A small promise", text: "Before the day gets busy, Leo puts a notebook beside the kettle. The goal is modest: write one sentence while the water warms. On the first morning he forgets. On the next, he remembers. The change is almost invisible, but the notebook is no longer an idea; it has a place in the room." },
    { heading: "Make the next step easier", text: "Leo stops waiting for a perfect burst of motivation and studies the path instead. Shoes by the door. A book on the desk. A reminder where his eyes already travel. Each adjustment removes one small obstacle. Progress begins to feel less like a test of character and more like a friendly arrangement with tomorrow." },
  ],
  "normal-people": [
    { heading: "The things left unsaid", text: "At a crowded gathering, two old friends fall into the kind of conversation that makes the room recede. They trade jokes, then pauses. Each knows the other's habits well enough to notice when a sentence turns away from its real subject. Outside, the evening air gives them a little more room to speak." },
    { heading: "Finding a shared rhythm", text: "Their lives move at different speeds, but certain silences still fit. A walk becomes an exchange of half-finished thoughts: a worry about the future, a small triumph, a question neither can answer. They do not solve everything before reaching the corner. For now, paying attention is its own kind of kindness." },
  ],
  sapiens: [
    { heading: "A story around the fire", text: "Imagine a night sky before maps, clocks, or written names. A small group gathers around a fire and shares an account of where the river bends. The details are practical, but the telling creates something larger: a memory many people can carry together, changing how they understand the place they call home." },
    { heading: "Ideas that travel", text: "Long after the fire fades, the story moves from one camp to another. It gains new details and gathers new listeners. Shared ideas can help strangers cooperate, build customs, and imagine common futures. Looking at the past this way turns history into a study of both material needs and the meanings people make together." },
  ],
  "little-life": [
    { heading: "A place at the table", text: "Four friends squeeze around a kitchen table after a long week. The meal is simple, the chairs do not match, and everyone arrives carrying a different kind of tiredness. They make space without asking for an explanation. In the soft light, companionship is not a grand gesture; it is remembering who takes tea without sugar." },
    { heading: "Staying beside someone", text: "Years pass, and the friends learn that care is often made of small repetitions: a call returned, a key kept safe, a quiet walk after difficult news. No one has a perfect answer for the hurt another person carries. Still, they return. The promise is not to fix every story, but to face it together." },
  ],
  "design-everyday": [
    { heading: "The stubborn door", text: "A new visitor pushes the glass door, then pulls, then tries again. A small sign explains the trick, but the handle had already suggested the wrong action. The designer makes a note: people do not fail a design in isolation. The shape, label, and context all help create the result." },
    { heading: "Let the object explain itself", text: "The team changes the handle so its shape hints at the right movement. On the next visit, people pass through without stopping. Nothing about the visitor changed; the clues did. Good design makes the useful action easier to see, and leaves fewer instructions for someone to memorize." },
  ],
  "fourth-wing": [
    { heading: "The ridge at dawn", text: "A cold wind rolls over the ridge as the recruits gather below the old watchtower. Beyond it, dark peaks cut into the sunrise. Their maps disagree, their equipment is worn, and nobody has been promised an easy route. The captain points to a narrow pass and asks who is willing to lead." },
    { heading: "A test of trust", text: "The climb begins with loose stone and a sudden bank of mist. A companion slips; another reaches out before thinking. The group has no time to become fearless. They make progress by calling out each foothold, sharing what they can carry, and learning whose judgment holds steady when the path disappears." },
  ],
};
const extendedPages = {
  Fiction: [
    { heading: "A new turn", text: "The next day brings a small interruption that changes the plan. A familiar street looks different in morning light, and a passing conversation leaves a question behind. There is no map for the choice ahead, only a few clues and the sense that it is time to pay closer attention." },
    { heading: "What comes next", text: "By evening, the characters have learned something they could not have discovered by staying comfortable. The answer is not neat, but it is theirs. They take the next step with more care than certainty, carrying the people and moments that helped them get this far." },
  ],
  Memoir: [
    { heading: "A wider view", text: "With time, the memory gains new edges. The narrator can see the younger self more clearly now: the hopes, blind spots, and strength that were hard to recognize at the time. Reconsidering the past does not erase it; it makes room for a fuller account." },
    { heading: "Making meaning", text: "One conversation opens another, and a private experience becomes easier to hold in the open. The story belongs to one person, yet its questions travel outward—to family, belonging, and the courage to change. The act of telling becomes a way to keep learning." },
  ],
  "Self-growth": [
    { heading: "The practice takes shape", text: "A week later, the routine meets a busy morning. Instead of abandoning it, the reader makes the action smaller and starts again. That adjustment matters: a useful practice is one that can survive real life, not only an ideal day." },
    { heading: "Notice what is working", text: "At the end of the month, the change is easier to see in the notes than in any single moment. There were missed days, restarts, and a few surprising wins. The next goal is not perfection; it is to keep the environment supportive and the promise realistic." },
  ],
  History: [
    { heading: "Reading the evidence", text: "A fragment of pottery, a record of trade, and a story passed between generations each reveal a different angle. None can explain an entire society alone. Together, they invite careful questions about how people lived, what they valued, and what the surviving evidence may leave out." },
    { heading: "A past still present", text: "Old decisions continue to shape roads, languages, and shared customs. Following those connections helps make the present less mysterious. History is not a straight line toward today; it is a layered conversation among people whose choices had consequences beyond their own lifetimes." },
  ],
  Design: [
    { heading: "Test it with real people", text: "The redesigned prototype looks promising on the workbench, but the team waits to see how someone encounters it without instructions. They watch quietly, note each hesitation, and resist explaining the intended use. The moments of confusion are not interruptions; they are the most useful clues." },
    { heading: "Improve one signal", text: "A clearer label and a more visible control remove the largest obstacle. The team tests again, then adjusts the spacing. Each round is small, but the product becomes easier to understand. Thoughtful design grows through observation, iteration, and respect for the people using it." },
  ],
  Fantasy: [
    { heading: "Beyond the pass", text: "Past the ridge, the travelers find a valley marked on none of their charts. Strange lights move between the trees, and an abandoned marker bears a symbol one of them recognizes. They have a choice: turn back with the warning, or follow the trail before the weather closes in." },
    { heading: "The promise of the journey", text: "The group sets out together, each bringing a different skill and a different reason to continue. Their first discovery raises more questions than it answers. Whatever waits ahead, they will need patience, courage, and the trust to let another person take the lead." },
  ],
};
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
  const nav = [["Home", "index.html", "home"], ["Books", "books.html", "books"], ["Search", "search.html", "search"], ["Subscribe", "subscription.html", "subscription"]];
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
  return `<article class="book-card" data-book-card="${escapeHtml(book.id)}"><div class="cover-wrap" style="--cover-bg:${escapeHtml(book.color || "#e8e1d6")}">${book.badge ? `<span class="badge">${escapeHtml(book.badge)}</span>` : ""}<button class="cover-preview" type="button" data-preview="${escapeHtml(book.id)}" aria-label="Read a preview of ${escapeHtml(book.title)}"><img src="${cover(book)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" onerror="this.style.visibility='hidden'"></button></div>
    <div class="book-info"><p class="book-category">${escapeHtml(book.category)}</p><h3 class="book-title" title="${escapeHtml(book.title)}"><button class="book-title-button" type="button" data-preview="${escapeHtml(book.id)}">${escapeHtml(book.title)}</button></h3><p class="book-author">by ${escapeHtml(book.author)}</p>
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

function subscriptionPage() {
  const isSubscribed = localStorage.getItem(demoSubscriptionKey) === "active";
  const bookId = new URLSearchParams(location.search).get("book");
  const continueUrl = bookId ? `books.html?read=${encodeURIComponent(bookId)}&page=2` : "books.html";
  return `<main class="page-main subscription-main"><div class="container"><section class="subscription-card">
    <p class="eyebrow">${isSubscribed ? "Your reading room is ready" : "Keep turning the pages"}</p>
    <h1>${isSubscribed ? "Your subscription is active" : "Read beyond the preview"}</h1>
    <p class="subscription-intro">Enjoy more BookVerse reading samples with one simple monthly plan.</p>
    <div class="subscription-price"><strong>$9.99</strong><span>/ month</span></div>
    <ul class="subscription-benefits"><li>Continue reading beyond the first two pages</li><li>Explore subscriber-only sample pages</li><li>Cancel anytime in this demo experience</li></ul>
    <p class="subscription-disclaimer">Demo subscription only. No payment is collected or processed. A payment provider must be connected before real charges can be made.</p>
    ${isSubscribed ? `<a class="button" href="${continueUrl}">Continue reading →</a>` : `<button class="button" type="button" data-activate-demo-subscription>Activate demo subscription · $9.99/month</button>`}
    <a class="subscription-back-link" href="books.html">Back to the bookshelf</a>
  </section></div></main>`;
}

function readerModalMarkup() {
  return `<div class="modal fade book-reader-modal" id="book-reader-modal" tabindex="-1" aria-labelledby="reader-book-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content">
      <div class="modal-header"><div><p class="eyebrow">BookVerse reading preview</p><h2 class="modal-title" id="reader-book-title"></h2><p class="reader-byline" id="reader-book-byline"></p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close preview"></button></div>
      <div class="modal-body" id="reader-modal-body"></div><div class="modal-footer" id="reader-modal-footer"></div>
    </div></div>
  </div>`;
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
        : page === "subscription" ? subscriptionPage()
        : page === "login" ? authPage(false)
          : page === "signup" ? authPage(true)
            : page === "logout" ? logoutPage()
              : page === "cart" ? cartPage()
                : checkoutPage();
  const hasBookCards = ["home", "books", "search"].includes(page);
  app.innerHTML = `${header()}${content}${hasBookCards ? readerModalMarkup() : ""}${footer()}`;
  if (page === "books" || page === "search") {
    const categoryFromUrl = new URLSearchParams(location.search).get("category");
    const categoryFilter = document.querySelector("#category-filter");
    if ([...categoryFilter.options].some((option) => option.value === categoryFromUrl)) categoryFilter.value = categoryFromUrl;
    categoryFilter.addEventListener("change", renderCatalog);
    document.querySelector("#sort-books").addEventListener("change", renderCatalog);
    renderCatalog();
  }
  if (page === "books") {
    const readBookId = new URLSearchParams(location.search).get("read");
    const readPage = Number(new URLSearchParams(location.search).get("page"));
    if (readBookId) openBookPreview(readBookId, Number.isInteger(readPage) && readPage >= 0 ? readPage : 0);
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

function openBookPreview(bookId, pageIndex = 0) {
  const book = books.find((item) => item.id === bookId);
  if (!book) return;
  const modalElement = document.querySelector("#book-reader-modal");
  if (!modalElement || !window.bootstrap?.Modal) {
    showToast("The book preview could not be opened. Please try again.");
    return;
  }
  const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
  renderReaderPage(book, pageIndex);
  modal.show();
}

function renderReaderPage(book, pageIndex) {
  const modalElement = document.querySelector("#book-reader-modal");
  const body = modalElement.querySelector("#reader-modal-body");
  const footer = modalElement.querySelector("#reader-modal-footer");
  const pageNumber = Math.min(Math.max(pageIndex, 0), 4);
  const isSubscribed = localStorage.getItem(demoSubscriptionKey) === "active";
  const isLocked = pageNumber >= 2 && !isSubscribed;
  modalElement.dataset.bookId = book.id;
  modalElement.dataset.pageIndex = pageNumber;
  document.querySelector("#reader-book-title").textContent = book.title;
  document.querySelector("#reader-book-byline").textContent = `by ${book.author}`;

  if (isLocked) {
    body.innerHTML = `<section class="reader-paywall"><span class="reader-lock" aria-hidden="true">✦</span><p class="eyebrow">You've reached the end of the free preview</p><h3>Enjoying ${escapeHtml(book.title)}?</h3><p>The first two sample pages are free. Subscribe to continue with more original reading samples.</p><a class="button" href="subscription.html?book=${encodeURIComponent(book.id)}">See the $9.99/month subscription →</a><small>Demo only: no payment is collected or processed.</small></section>`;
    footer.innerHTML = `<button type="button" class="btn btn-outline-secondary reader-nav-button" data-reader-prev>← Previous</button><span class="reader-page-count">Preview ended · 2 free pages</span><button type="button" class="btn btn-light reader-nav-button" data-bs-dismiss="modal">Close</button>`;
    return;
  }

  const pageContent = pageNumber < 2
    ? previewPages[book.id]?.[pageNumber]
    : extendedPages[book.category]?.[pageNumber - 2];
  if (!pageContent) {
    body.innerHTML = `<section class="reader-paywall"><p class="eyebrow">Preview complete</p><h3>Thanks for reading</h3><p>That's the end of this BookVerse sample. Add the book to your bag to explore the full published edition.</p><button class="button" type="button" data-reader-add="${escapeHtml(book.id)}">＋ Add to bag · ${money(book.price)}</button></section>`;
  } else {
    body.innerHTML = `<article class="reader-page"><p class="reader-page-label">PAGE ${pageNumber + 1}</p><h3>${escapeHtml(pageContent.heading)}</h3><p>${escapeHtml(pageContent.text)}</p><p class="reader-note">Original sample content created for this demo — not an excerpt from the published book.</p></article>`;
  }
  const pageCountLabel = pageNumber === 4 ? "Sample complete" : `Page ${pageNumber + 1} ${pageNumber < 2 ? "of 2 free" : "of 4 subscriber sample"}`;
  const nextLabel = pageNumber === 3 ? "Finish reading" : pageNumber === 4 ? "Done" : "Next page";
  footer.innerHTML = `<button type="button" class="btn btn-outline-secondary reader-nav-button" data-reader-prev ${pageNumber === 0 ? "disabled" : ""}>← Previous</button><span class="reader-page-count">${pageCountLabel}</span><button type="button" class="btn btn-outline-secondary reader-nav-button" data-reader-next>${nextLabel} →</button>`;
  if (pageNumber === 4) footer.querySelector("[data-reader-next]").disabled = true;
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
  const previewButton = event.target.closest("[data-preview]");
  const bookCard = event.target.closest("[data-book-card]");
  const nextReaderPage = event.target.closest("[data-reader-next]");
  const previousReaderPage = event.target.closest("[data-reader-prev]");
  const activateSubscription = event.target.closest("[data-activate-demo-subscription]");
  const readerAddButton = event.target.closest("[data-reader-add]");
  const addButton = event.target.closest("[data-add]");
  const stepButton = event.target.closest("[data-step]");
  const removeButton = event.target.closest("[data-remove]");
  if (activateSubscription) {
    localStorage.setItem(demoSubscriptionKey, "active");
    const bookId = new URLSearchParams(location.search).get("book");
    location.href = bookId ? `books.html?read=${encodeURIComponent(bookId)}&page=2` : "books.html";
    return;
  }
  if (previewButton || bookCard) {
    if (!event.target.closest("[data-add]")) openBookPreview((previewButton || bookCard).dataset.preview || (previewButton || bookCard).dataset.bookCard);
    if (!event.target.closest("[data-add]")) return;
  }
  if (nextReaderPage || previousReaderPage) {
    const bookId = document.querySelector("#book-reader-modal").dataset.bookId;
    const currentPage = Number(document.querySelector("#book-reader-modal").dataset.pageIndex);
    renderReaderPage(books.find((book) => book.id === bookId), currentPage + (nextReaderPage ? 1 : -1));
    return;
  }
  if (readerAddButton) {
    const book = books.find((item) => item.id === readerAddButton.dataset.readerAdd);
    if (book) {
      try {
        cart = await api(`/cart/items/${encodeURIComponent(book.id)}`, { method: "POST", body: JSON.stringify({ quantity: 1 }) });
        updateCartCount();
        showToast(`${book.title} added to your bag`);
      } catch (error) {
        showToast(error.message);
      }
    }
    return;
  }
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
