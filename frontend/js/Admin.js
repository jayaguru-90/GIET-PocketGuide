// Base Configuration
const API_BASE = "http://localhost:5000/api";
let currentLocations = [];

// DOM Elements
const authModal = document.getElementById("authModal");
const dashboardApp = document.getElementById("dashboardApp");
const loginForm = document.getElementById("loginForm");
const authError = document.getElementById("authError");
const logoutBtn = document.getElementById("logoutBtn");

const locationForm = document.getElementById("locationForm");
const formModeTitle = document.getElementById("formModeTitle");
const locationIdInput = document.getElementById("locationId");
const locNameInput = document.getElementById("locName");
const locCategoryInput = document.getElementById("locCategory");
const locXInput = document.getElementById("locX");
const locYInput = document.getElementById("locY");
const locDescInput = document.getElementById("locDesc");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveBtn = document.getElementById("saveBtn");

const searchBar = document.getElementById("searchBar");
const locationList = document.getElementById("locationList");

// ================= AUTHENTICATION ================= //

function checkAuth() {
  const token = localStorage.getItem("gietu_admin_token");
  if (!token) {
    authModal.classList.remove("hidden");
    dashboardApp.classList.add("hidden");
  } else {
    authModal.classList.add("hidden");
    dashboardApp.classList.remove("hidden");
    fetchLocations();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.innerText = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    localStorage.setItem("gietu_admin_token", data.token);
    loginForm.reset();
    checkAuth();
  } catch (err) {
    authError.innerText = err.message;
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("gietu_admin_token");
  checkAuth();
});

// Helper for authenticated API calls
async function authFetch(url, options = {}) {
  const token = localStorage.getItem("gietu_admin_token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("gietu_admin_token");
    checkAuth();
    throw new Error("Session expired. Please sign in again.");
  }
  return response;
}

// ================= CRUD OPERATIONS ================= //

async function fetchLocations() {
  try {
    const res = await fetch(`${API_BASE}/locations`);
    currentLocations = await res.json();
    renderTable(currentLocations);
  } catch (err) {
    console.error("Failed to load locations", err);
  }
}

function renderTable(locations) {
  locationList.innerHTML = "";
  if (!locations.length) {
    locationList.innerHTML = `