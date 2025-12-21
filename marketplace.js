// marketplace.js
// Dynamic prototype logic now (random + simple rules)
// Later you can replace analyzeMarket() with a fetch() to backend/marketplace_analyze.php

function setDemo(crop) {
  const cropInput = document.getElementById("cropName");
  if (cropInput) cropInput.value = crop;

  // Auto-fill location from stored profile
  const storedProfile =
    JSON.parse(localStorage.getItem("farmerProfile") || "null") ||
    JSON.parse(localStorage.getItem("profile") || "null");

  const locationInput = document.getElementById("location");
  if (storedProfile && storedProfile.location && locationInput) {
    locationInput.value = storedProfile.location;
  }
}

// Auto season detection (Bangladesh-friendly rough mapping)
function detectSeason() {
  const m = new Date().getMonth() + 1; // 1..12
  // Rabi: Nov–Mar, Kharif-1: Apr–Jun, Kharif-2: Jul–Oct
  if (m >= 11 || m <= 3) return "Rabi";
  if (m >= 4 && m <= 6) return "Kharif-1";
  return "Kharif-2";
}

function analyzeMarket() {
  const crop = (document.getElementById("cropName")?.value || "").trim();
  const location = (document.getElementById("location")?.value || "").trim();
  const seasonSelect = document.getElementById("season");
  const season =
    seasonSelect?.value === "auto"
      ? detectSeason()
      : (seasonSelect?.value || "Auto");

  if (!crop || !location) {
    alert("Please enter Crop Name and Location.");
    return;
  }

  const result = mockMarketAnalysis({ crop, location, season });

  document.getElementById("priceRange").innerText =
    `${result.priceMin} - ${result.priceMax}`;

  document.getElementById("demandLevel").innerText = result.demand;

  document.getElementById("sellingTime").innerText = result.bestTime;

  document.getElementById("marketAdvice").innerText = result.advice;
}

// Simple mock engine (you can expand with dataset logic)
function mockMarketAnalysis({ crop, location, season }) {
  const cropKey = crop.toLowerCase();

  // Base price by crop (demo numbers)
  let baseMin = 40;
  let baseMax = 55;
  let demand = "Medium";

  if (cropKey.includes("rice") || cropKey.includes("ধান")) {
    baseMin = 45; baseMax = 60; demand = "High";
  } else if (cropKey.includes("potato") || cropKey.includes("আলু")) {
    baseMin = 25; baseMax = 40; demand = "Medium";
  } else if (cropKey.includes("tomato") || cropKey.includes("টমেটো")) {
    baseMin = 35; baseMax = 65; demand = "High";
  } else if (cropKey.includes("onion") || cropKey.includes("পেঁয়াজ")) {
    baseMin = 60; baseMax = 90; demand = "High";
  }

  // Seasonal adjustment
  let seasonFactor = 0;
  if (season === "Rabi") seasonFactor = 5;
  if (season === "Kharif-2") seasonFactor = 3;

  // Location adjustment (light demo)
  const locKey = location.toLowerCase();
  let locFactor = 0;
  if (locKey.includes("dhaka") || locKey.includes("ঢাকা")) locFactor = 4;
  if (locKey.includes("chattogram") || locKey.includes("ctg") || locKey.includes("চট্টগ্রাম")) locFactor = 3;

  // Small randomness
  const rand = () => Math.floor(Math.random() * 4); // 0..3

  const priceMin = baseMin + seasonFactor + locFactor + rand();
  const priceMax = baseMax + seasonFactor + locFactor + rand();

  // Best selling time suggestion
  let bestTime = "Next 1–2 weeks";
  if (demand === "High") bestTime = "Next 2–3 weeks";
  if (season === "Rabi") bestTime = "Within next 7–14 days";

  const advice =
    `📍 Location: ${location}\n` +
    `🌾 Crop: ${crop}\n` +
    `🗓️ Season: ${season}\n\n` +
    `✅ Estimated price range is based on a prototype rule-set (demo).\n` +
    `• Grade/sort produce before selling\n` +
    `• Avoid selling immediately after harvest if market supply is very high\n` +
    `• Consider proper storage/packaging to reduce damage and increase value\n\n` +
    `Next upgrade: this will connect to dataset + AI model for real market trends.`;

  return { priceMin, priceMax, demand, bestTime, advice };
}

/* =========================================================
   Page Init (safe)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // Auto-fill location if profile exists
  const storedProfile =
    JSON.parse(localStorage.getItem("farmerProfile") || "null") ||
    JSON.parse(localStorage.getItem("profile") || "null");

  const locEl = document.getElementById("location");
  if (storedProfile?.location && locEl) locEl.value = storedProfile.location;

  // Apply profile photo if script.js provides the function
  if (typeof applySavedProfilePhoto === "function") {
    applySavedProfilePhoto();
  }
});

// Live sync across tabs/pages (Profile -> Marketplace, Chat, etc.)
window.addEventListener("storage", (e) => {
  if (e.key === "krishibotProfilePhoto" && typeof applySavedProfilePhoto === "function") {
    applySavedProfilePhoto();
  }
});
