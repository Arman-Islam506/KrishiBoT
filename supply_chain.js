/* =========================================================
   KrishiBoT – Supply Chain Planner
   Demo Rule Engine + Backend DB Save
   File: supply_chain.js
   Backend: backend/save_supply_chain.php
   ========================================================= */

/* =========================
   Small helpers
========================= */
const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function safeText(v) {
  return (v || "").toString().trim();
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unitToKg(qty, unit) {
  if (unit === "kg") return qty;
  if (unit === "ton") return qty * 1000;
  if (unit === "mon") return qty * 40; // demo assumption
  return qty;
}

function riskLabel(score) {
  if (score <= 3) return "Low";
  if (score <= 6) return "Medium";
  return "High";
}

function moneyBDT(n) {
  return `BDT ${Math.round(n).toLocaleString("en-US")}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

/* =========================
   Local Storage (demo)
========================= */
const STORE_KEY = "krishibot_supplychain_demo";

function saveInputs(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function loadInputs() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

/* =========================
   Backend save (DB)
========================= */
async function saveSupplyChainPlan(payload) {
  const res = await fetch("backend/save_supply_chain.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  try {
    const json = await res.json();
    return res.ok ? json : { success: false, message: json.message || "HTTP error" };
  } catch {
    return { success: false, message: "Invalid JSON from server" };
  }
}

/* =========================
   DEMO RULE ENGINE
========================= */
function computePlan(input) {
  const crop = input.crop.toLowerCase();
  const qtyKg = unitToKg(input.qty, input.unit);

  /* --- Perishability --- */
  let perishability = 3;
  if (["tomato", "eggplant", "chili"].some(c => crop.includes(c))) perishability = 8;
  if (crop.includes("potato") || crop.includes("onion")) perishability = 4;
  if (["rice", "wheat", "maize"].some(c => crop.includes(c))) perishability = 2;

  /* --- Packaging factor --- */
  const packFactorMap = { loose: 0.8, sack: 1.0, crate: 1.3, box: 1.4 };
  const packFactor = packFactorMap[input.packaging] || 1.0;

  /* --- Storage --- */
  const storageDays = input.storage === "cold" ? 20 : input.storage === "basic" ? 5 : 0;

  /* --- Risk score --- */
  const lateDays = input.harvestDate ? daysBetween(input.harvestDate, todayISO()) : 0;
  let riskScore = Math.round(perishability / 2);
  if (input.packaging === "loose") riskScore += 2;
  if (input.storage === "none") riskScore += 2;
  riskScore += Math.min(3, Math.floor(lateDays / 2));
  if (qtyKg > 5000) riskScore += 1;

  /* --- Dispatch timing --- */
  let dispatch = "Next 24–48 hours";
  if (perishability >= 8) dispatch = "Within 12–24 hours (very perishable)";
  else if (storageDays >= 15) dispatch = "Within 7–14 days (store first)";
  else if (storageDays >= 5) dispatch = "Within 3–7 days (short storage)";

  /* --- Costs (demo) --- */
  const packCostMap = { loose: 0.6, sack: 1.2, crate: 2.2, box: 2.6 };
  const buyerCostMap = {
    local_market: 1.2,
    wholesaler: 1.5,
    processor: 1.8,
    retail_chain: 2.0
  };

  const packagingCost = qtyKg * (packCostMap[input.packaging] || 1.2) * packFactor;
  const transportCost = qtyKg * (buyerCostMap[input.buyer] || 2.4);
  const handlingCost = qtyKg * 0.7;
  const totalCost = packagingCost + transportCost + handlingCost;

  /* --- Steps --- */
  const steps = [
    "Harvest early morning to reduce heat damage.",
    "Sort/grading: separate premium vs damaged produce.",
    `Packaging: use ${input.packaging} with padding to reduce bruising.`,
    input.storage === "none"
      ? "No storage – sell quickly."
      : input.storage === "basic"
      ? "Use basic short-term storage."
      : "Use cold storage if possible.",
    `Transport plan: dispatch ${dispatch.toLowerCase()}.`,
    `Buyer strategy: target ${input.buyer.replaceAll("_", " ")}.`,
    "Keep records: harvest date, quantity, buyer, transport cost."
  ];

  /* --- Alerts --- */
  const alerts = [];
  if (perishability >= 8 && input.storage === "none")
    alerts.push("High spoilage risk: perishable crop with no storage.");
  if (input.packaging === "loose" && perishability >= 6)
    alerts.push("Damage risk: loose packaging for sensitive produce.");
  if (qtyKg > 8000)
    alerts.push("Large volume: consider splitting transport loads.");
  if (!input.harvestDate)
    alerts.push("Harvest date missing – timing is estimated.");
  if (!alerts.length)
    alerts.push("No major risk detected (demo).");

  return {
    dispatch,
    risk: riskLabel(riskScore),
    cost: totalCost,
    breakdown: { packagingCost, transportCost, handlingCost, totalCost },
    steps,
    alerts
  };
}

/* =========================
   UI rendering
========================= */
function renderPlan(input, result) {
  setText("metaLoc", input.location || "—");
  setText("metaCrop", input.crop || "—");
  setText("metaSeason", input.season || "—");

  setText("kpiDispatch", result.dispatch);
  setText("kpiRisk", result.risk);
  setText("kpiCost", moneyBDT(result.cost));

  $("stepPlan").innerHTML = result.steps.map(s => `<li>${s}</li>`).join("");

  $("costBox").innerHTML = `
    <div class="cost-line"><span>Packaging</span><b>${moneyBDT(result.breakdown.packagingCost)}</b></div>
    <div class="cost-line"><span>Transport</span><b>${moneyBDT(result.breakdown.transportCost)}</b></div>
    <div class="cost-line"><span>Handling</span><b>${moneyBDT(result.breakdown.handlingCost)}</b></div>
    <div class="cost-total"><span>Total</span><b>${moneyBDT(result.breakdown.totalCost)}</b></div>
  `;

  $("alertsList").innerHTML = result.alerts.map(a => `<li>${a}</li>`).join("");
}

/* =========================
   Auto Fill (Realistic demo values)
   Based on: crop + district
========================= */
function applyAutoFill() {
  // Helpers (local)
  const titleCase = (s) =>
    safeText(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const setValue = (id, value) => {
    const el = $(id);
    if (el) el.value = value;
  };

  // Normalize inputs
  const crop = titleCase($("cropName")?.value);
  const location = titleCase($("location")?.value);

  if (!crop || !location) return;

  // 1) Season (Bangladesh style)
  const seasonMap = {
    Rice: "Kharif-2",
    Tomato: "Kharif-2",
    Chili: "Kharif-2",
    Eggplant: "Kharif-2",
    Potato: "Rabi",
    Onion: "Rabi",
    Wheat: "Rabi",
    Mustard: "Rabi",
    Lentil: "Rabi",
    Maize: "Kharif-1",
    Jute: "Kharif-1"
  };
  setValue("season", seasonMap[crop] || "Kharif-2");

  // 2) Unit default
  const unitMap = {
    Rice: "ton",
    Wheat: "ton",
    Maize: "ton",
    Jute: "ton",
    Potato: "mon",
    Onion: "mon",
    Tomato: "kg",
    Chili: "kg",
    Eggplant: "kg",
    Mustard: "mon",
    Lentil: "mon"
  };
  setValue("unit", unitMap[crop] || "kg");

  // 3) Quantity base (kg)
  const baseKgMap = {
    Rice: 6000,
    Wheat: 3500,
    Maize: 4000,
    Jute: 5000,
    Potato: 2500,
    Onion: 1800,
    Tomato: 900,
    Chili: 450,
    Eggplant: 700,
    Mustard: 1200,
    Lentil: 1000
  };

  // 4) District factor
  const districtFactorMap = {
    Dhaka: 0.85,
    Chittagong: 1.0,
    Rajshahi: 1.15,
    Khulna: 1.0,
    Barisal: 0.95,
    Sylhet: 0.8,
    Rangpur: 1.2
  };

  const unit = $("unit")?.value || "kg";
  const kg = Math.round((baseKgMap[crop] || 800) * (districtFactorMap[location] || 1.0));

  // Convert kg -> chosen unit
  let qty = kg;
  if (unit === "mon") qty = Math.max(1, Math.round(kg / 40));
  if (unit === "ton") qty = Math.max(0.5, +(kg / 1000).toFixed(2));

  setValue("quantity", qty);

  // 5) Harvest date (10–18 days ahead)
  const daysAhead = 10 + Math.floor(((crop + location).length * 3) % 9);
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  setValue("harvestDate", d.toISOString().slice(0, 10));

  // 6) Storage default
  const coldCrops = new Set(["Potato"]);
  const basicCrops = new Set(["Tomato", "Chili", "Eggplant"]);
  setValue("storage", coldCrops.has(crop) ? "cold" : "basic");

  // 7) Packaging default
  const crateCrops = new Set(["Tomato", "Eggplant", "Chili"]);
  const sackCrops = new Set(["Rice", "Wheat", "Maize", "Jute"]);
  setValue("packaging", crateCrops.has(crop) ? "crate" : sackCrops.has(crop) ? "sack" : "box");

  // 8) Buyer default
  const processorCrops = new Set(["Rice", "Wheat", "Maize"]);
  const wholesalerCrops = new Set(["Potato", "Onion"]);
  setValue("buyer", processorCrops.has(crop) ? "processor" : wholesalerCrops.has(crop) ? "wholesaler" : "local_market");
}

/* =========================
   Init
========================= */
document.addEventListener("DOMContentLoaded", () => {
  $("cropName")?.addEventListener("change", applyAutoFill);
  $("location")?.addEventListener("change", applyAutoFill);

  
  if ($("harvestDate")) $("harvestDate").value = todayISO();

  const saved = loadInputs();
  if (Object.keys(saved).length) {
    Object.entries(saved).forEach(([k, v]) => $(k) && ($(k).value = v));
    if (saved.crop && saved.location && saved.qty) {
      renderPlan(saved, computePlan(saved));
    }
  }

  // Quick Crops click handler
   document.querySelectorAll("#quickCrops .quick-item").forEach(btn => {
    btn.onclick = () => {
      $("cropName").value = btn.dataset.crop || "";
      if (typeof applyAutoFill === "function") applyAutoFill();
    };
  });
  
  // Quick Locations click handler
document.querySelectorAll("#quickLocations .quick-item").forEach(btn => {
  btn.onclick = () => {
    $("location").value = btn.dataset.loc || btn.dataset.location || "";
    if (typeof applyAutoFill === "function") applyAutoFill();
  };
});


  $("planBtn").onclick = async () => {
    const data = {
      crop: safeText($("cropName").value),
      location: safeText($("location").value),
      season: $("season").value,
      qty: toNumber($("quantity").value),
      unit: $("unit").value,
      harvestDate: $("harvestDate").value,
      storage: $("storage").value,
      packaging: $("packaging").value,
      buyer: $("buyer").value
    };

    if (!data.crop || !data.location || !data.qty) {
      alert("Enter Crop, Location and Quantity.");
      return;
    }

    saveInputs(data);

    const result = computePlan(data);
    renderPlan(data, result);

    await saveSupplyChainPlan({
      farmer_id: Number(localStorage.getItem("farmer_id") || 1),
      ...data,
      recommended_dispatch: result.dispatch,
      risk_level: result.risk,
      logistics_cost: result.cost,
      steps: result.steps,
      alerts: result.alerts,
      cost_breakdown: result.breakdown
    });
  };

  $("resetBtn").onclick = () => {
    if (!confirm("Reset planner data?")) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
  };
});
