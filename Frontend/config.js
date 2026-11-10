const isLocalBookVerse =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

window.BOOKVERSE_CONFIG = {
  apiBaseUrl: isLocalBookVerse
    ? "http://127.0.0.1:8000/api"
    : "https://bookverse-2yw0.onrender.com/api"
};
