/****************************************************
 * 1. PROFILE PHOTO (localStorage)
 ****************************************************/

// Load saved profile picture (.profile-circle + .profile-photo-large)
function applySavedProfilePhoto() {
    const saved = localStorage.getItem("krishibotProfilePhoto");
    if (!saved) return;

    // Update IMG elements that already exist
    document.querySelectorAll(".profile-circle, .profile-photo-large").forEach(el => {
        if (el.tagName === "IMG") {
            el.src = saved;
        }
    });

    // Chat navbar avatar
    const topImg = document.getElementById("topProfileImg");
    if (topImg && topImg.tagName === "IMG") {
        topImg.src = saved;
        topImg.style.display = "block";
    }

    // Hide emoji fallback
    const fallback = document.getElementById("topProfileFallback");
    if (fallback) fallback.style.display = "none";
}


// Handle "Upload Photo" input
function setupProfileUpload() {
    const input = document.getElementById("profilePhotoInput");
    if (!input) return;

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            localStorage.setItem("krishibotProfilePhoto", ev.target.result);
            applySavedProfilePhoto();
        };
        reader.readAsDataURL(file);
    });
}


/****************************************************
 * 2. GLOBAL SETTINGS (system / chatbot / interface / privacy)
 ****************************************************/

function loadKrishiSettings() {
    let stored = {};
    try {
        stored = JSON.parse(localStorage.getItem("krishibotSettings") || "{}");
    } catch (e) {
        stored = {};
    }

    // default values
    return Object.assign({
        language: "bn+en",
        adviceMode: "simple",
        units: "local",
        voiceSTT: false,
        voiceTTS: false,
        useGPS: false,

        responseStyle: "simple",
        answerLanguage: "mixed",
        showTips: true,

        theme: "light",
        density: "comfortable",

        saveHistory: true,
        shareAnalytics: false
    }, stored);
}

function saveKrishiSettings(settings) {
    localStorage.setItem("krishibotSettings", JSON.stringify(settings));
}

// global settings object used elsewhere (chat, etc.)
let kbSettings = loadKrishiSettings();


/****************************************************
 * 3. FARMER AUTH (LOGIN / PROTECTION / LOGOUT)
 ****************************************************/

// Farmer login page: index.html
function setupFarmerAuth() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "index.html" && page !== "") return;

    const phoneInput = document.getElementById("farmerPhone");
    const passInput  = document.getElementById("farmerPassword");
    const loginBtn   = document.getElementById("farmerLoginBtn");
    const createBtn  = document.getElementById("createAccountBtn");

    // "Create account" → register.html
    if (createBtn) {
        createBtn.addEventListener("click", () => {
            window.location.href = "register.html";
        });
    }

    // Login with MySQL backend
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            const phone = phoneInput.value.trim();
            const pass  = passInput.value.trim();

            if (!phone || !pass) {
                alert("Please enter mobile number and password.");
                return;
            }

            const formData = new FormData();
            formData.append("phone", phone);
            formData.append("password", pass);

            fetch("backend/login.php", {
                method: "POST",
                body: formData
            })
                .then(res => res.json())
                .then(data => {
                    console.log("LOGIN RESPONSE:", data);

                    if (data.status === "success") {
                        localStorage.setItem("krishibotFarmerLoggedIn", "true");
                        localStorage.setItem("krishibotFarmerProfile", JSON.stringify(data.user));
                        window.location.href = "chat.html";

                    } else {
                        alert(data.message || "Login failed.");
                    }
                })
                .catch(err => {
                    console.error("Login fetch error:", err);
                    alert("Network error. Please try again.");
                });
        });
    }
}

// Protect chat, profile, settings if not logged in
function protectFarmerPages() {
    const page = window.location.pathname.split("/").pop();
    const protectedPages = ["chat.html", "settings.html", "profile.html"];
    if (!protectedPages.includes(page)) return;

    const loggedIn = localStorage.getItem("krishibotFarmerLoggedIn") === "true";
    if (!loggedIn) {
        window.location.href = "index.html";
    }
}

// Logout button (used on settings page)
function setupFarmerLogout() {
    const btn = document.getElementById("farmerLogoutBtn");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.setItem("krishibotFarmerLoggedIn", "false");
        window.location.href = "index.html";
    });
}


/****************************************************
 * 4. REGISTER & PROFILE FORMS
 ****************************************************/

function setupRegisterAndProfileForms() {
    const page = window.location.pathname.split("/").pop();
    const get = id => document.getElementById(id);

    /********** 4.1 REGISTER PAGE (register.html) **********/
    if (page === "register.html") {
        const saveBtn = get("registerSaveBtn");
        if (!saveBtn) return;

        // Prefill from previous local attempt (optional)
        const userStored = JSON.parse(localStorage.getItem("krishibotFarmerUser") || "{}");
        const profStored = JSON.parse(localStorage.getItem("krishibotFarmerProfile") || "{}");

        if (userStored.phone) get("regPhone").value = userStored.phone;
        if (userStored.email) get("regEmail").value = userStored.email;

        if (profStored.fullName)        get("fullName").value       = profStored.fullName || "";
        if (profStored.age)             get("age").value            = profStored.age || "";
        if (profStored.location)        get("location").value       = profStored.location || "";
        if (profStored.landArea)        get("landArea").value       = profStored.landArea || "";
        if (profStored.soilType)        get("soilType").value       = profStored.soilType || "";
        if (profStored.irrigationType)  get("irrigationType").value = profStored.irrigationType || "";
        if (profStored.langBangla !== undefined)  get("langBangla").checked  = profStored.langBangla;
        if (profStored.langEnglish !== undefined) get("langEnglish").checked = profStored.langEnglish;

        // Save new farmer
        saveBtn.addEventListener("click", () => {
            const phone = get("regPhone").value.trim();
            const email = get("regEmail").value.trim();
            const pass  = get("regPassword").value.trim();

            if (!phone || !pass) {
                alert("Mobile number and password are required to create an account.");
                return;
            }

            const fullName       = get("fullName").value.trim();
            const age            = get("age").value.trim();
            const locationVal    = get("location").value.trim();
            const landArea       = get("landArea").value.trim();
            const soilType       = get("soilType").value;
            const irrigationType = get("irrigationType").value;
            const langBangla     = get("langBangla").checked;
            const langEnglish    = get("langEnglish").checked;

            let prefLang = "";
            if (langBangla && langEnglish) prefLang = "bn+en";
            else if (langBangla)           prefLang = "bn";
            else if (langEnglish)          prefLang = "en";
            else                           prefLang = "bn"; // default

            // Prepare data for PHP backend
            const formData = new FormData();
            formData.append("phone",           phone);
            formData.append("email",           email);
            formData.append("password",        pass);
            formData.append("name",            fullName);
            formData.append("age",             age);
            formData.append("location",        locationVal);
            formData.append("land_area",       landArea);
            formData.append("soil_type",       soilType);
            formData.append("irrigation_type", irrigationType);
            formData.append("pref_lang",       prefLang);

            fetch("backend/register.php", {
                method: "POST",
                body: formData
            })
                .then(res => res.json())
                .then(data => {
                    console.log("REGISTER RESPONSE:", data);

                    if (data.status === "success") {
                        // Also store locally so older logic still works if needed
                        const userObj = { phone, email, pass };
                        localStorage.setItem("krishibotFarmerUser", JSON.stringify(userObj));

                        const profile = {
                            fullName,
                            age,
                            location:       locationVal,
                            landArea,
                            soilType,
                            irrigationType,
                            langBangla,
                            langEnglish
                        };
                        localStorage.setItem("krishibotFarmerProfile", JSON.stringify(profile));

                        alert("Account created successfully. Please login with your mobile and password.");
                        window.location.href = "index.html";
                    } else {
                        alert("Registration failed: " + (data.message || "Unknown error"));
                    }
                })
                .catch(err => {
                    console.error("Register fetch error:", err);
                    alert("Network error. Please try again.");
                });
        });
    }

    /********** 4.2 PROFILE PAGE (profile.html) **********/
    if (page === "profile.html") {
        const saveBtn = get("profileSaveBtn");
        if (!saveBtn) return;

        const profStored = JSON.parse(localStorage.getItem("krishibotFarmerProfile") || "{}");

        if (profStored.fullName)        get("fullName").value       = profStored.fullName || "";
        if (profStored.age)             get("age").value            = profStored.age || "";
        if (profStored.location)        get("location").value       = profStored.location || "";
        if (profStored.landArea)        get("landArea").value       = profStored.landArea || "";
        if (profStored.soilType)        get("soilType").value       = profStored.soilType || "";
        if (profStored.irrigationType)  get("irrigationType").value = profStored.irrigationType || "";
        get("langBangla").checked  = profStored.langBangla !== false; // default true
        get("langEnglish").checked = !!profStored.langEnglish;

        saveBtn.addEventListener("click", () => {
            const profile = {
                // keep existing DB id if present
                id:             profStored.id,
                fullName:       get("fullName").value.trim(),
                age:            get("age").value.trim(),
                location:       get("location").value.trim(),
                landArea:       get("landArea").value.trim(),
                soilType:       get("soilType").value,
                irrigationType: get("irrigationType").value,
                langBangla:     get("langBangla").checked,
                langEnglish:    get("langEnglish").checked
            };

            localStorage.setItem("krishibotFarmerProfile", JSON.stringify(profile));
            alert("Profile updated successfully.");
            window.location.href = "chat.html";
        });
    }
}


/****************************************************
 * 5. ADMIN AUTH (DB-based)
 ****************************************************/

function setupAdminLoginPage() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "admin_login.html") return;

    // On DB version we always show login form, hide setup
    const setupSection = document.getElementById("adminSetupSection");
    const loginSection = document.getElementById("adminLoginSection");
    if (setupSection) setupSection.style.display = "none";
    if (loginSection) loginSection.style.display = "block";

    const loginBtn = document.getElementById("adminLoginBtn");
    if (!loginBtn) return;

    loginBtn.addEventListener("click", () => {
        const id   = document.getElementById("adminIdLogin").value.trim();
        const pass = document.getElementById("adminPassLogin").value.trim();

        if (!id || !pass) {
            alert("Please enter Admin ID and password.");
            return;
        }

        const formData = new FormData();
        formData.append("admin_id", id);
        formData.append("password", pass);

        fetch("/backend/admin_login.php", {
            method: "POST",
            body: formData})
            .then(async (res) => {
                const text = await res.text();     // read raw response first
                try {
                    return JSON.parse(text);         // try JSON 
                    } catch {console.error("Non-JSON response:", text);
                        throw new Error("Server returned non-JSON");}
}).then(data => {
  if (data.status === "success") {
    localStorage.setItem("krishibotAdminLoggedIn", "true");
    localStorage.setItem("krishibotAdmin", JSON.stringify(data.admin));
    window.location.href = "admin.html";
  } else {
    alert(data.message || "Admin login failed.");
  }
})
.catch(err => {
  console.error("Admin login error:", err);
  alert("Network error. Please try again.");
});

    });
}

function protectAdminPage() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "admin.html") return;

    const loggedIn = localStorage.getItem("krishibotAdminLoggedIn") === "true";
    if (!loggedIn) {
        window.location.href = "admin_login.html";
    }
}

function setupAdminLogout() {
    const logoutLink = document.getElementById("adminLogoutLink");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("krishibotAdminLoggedIn");
        localStorage.removeItem("krishibotAdmin");
        window.location.href = "admin_login.html";
    });
}


/****************************************************
 * 6. CHAT / CONVERSATION LOGIC + DB SAVE/LOAD
 ****************************************************/

/* 6.1 GLOBALS */

let kbConversations   = [];                 // local previous conversations (history)
let kbCurrentConversation = null;          // active conversation in UI
let kbConversationKey = "kbConversations_guest"; // per-user storage key
let kbAnimateLastBot  = false;             // animate last bot reply

/* 6.2 SMALL HELPERS (ID, LOCAL HISTORY, AI CALL, TYPING EFFECT) */

// get farmer ID from stored profile (DB)
function getCurrentFarmerId() {
    try {
        const profile = JSON.parse(localStorage.getItem("krishibotFarmerProfile") || "{}");
        return profile.id || null; // make sure login.php sets user.id
    } catch (e) {
        return null;
    }
}

// Local history load (PER FARMER, using kbConversationKey)
function loadConversations() {
    try {
        if (kbSettings.saveHistory) {
            kbConversations = JSON.parse(localStorage.getItem(kbConversationKey) || "[]");
        } else {
            kbConversations = [];
        }
    } catch (e) {
        kbConversations = [];
    }
}

// Local history save (PER FARMER, using kbConversationKey)
function saveConversations() {
    if (!kbSettings.saveHistory) return;
    localStorage.setItem(kbConversationKey, JSON.stringify(kbConversations));
}

// Call backend AI endpoint
function askBackendAI(userText) {
    const formData = new FormData();
    formData.append("message", userText);

    const farmerId = getCurrentFarmerId();
    if (farmerId) {
        formData.append("farmer_id", farmerId);
    }

    return fetch("backend/ai_chat.php", {
        method: "POST",
        body: formData
    })
        .then(res => res.json())
        .catch(err => {
            console.error("AI backend error:", err);
            return { status: "error" };
        });
}

// Typing animation for bot bubble
function typeTextInBubble(bubble, fullText) {
    let i = 0;
    const speed = 20; // ms per character (smaller = faster)

    const wrapper = document.getElementById("chatWrapper");

    const interval = setInterval(() => {
        if (i >= fullText.length) {
            clearInterval(interval);
            kbAnimateLastBot = false;
            return;
        }

        bubble.textContent += fullText.charAt(i);
        i++;

        // keep scroll at bottom while typing
        if (wrapper) {
            wrapper.scrollTop = wrapper.scrollHeight;
        }
    }, speed);
}


/* 6.3 NEW CONVERSATION, TITLES, PROFILE, SIMPLE REPLY */

function createNewConversation() {
    kbCurrentConversation = {
        id: Date.now(),
        title: "",
        messages: []  // {from: 'user' | 'bot', text}
    };
}

// Title from first message
function titleFromText(text) {
    if (!text) return "Chat";

    let t = text.trim();
    t = t.replace(/[?!.,]+$/, "");               // Remove punctuation at end
    t = t.charAt(0).toUpperCase() + t.slice(1);  // Capitalize first letter
    if (t.length > 30) t = t.substring(0, 30) + "...";  // Limit length

    return t;
}

// Rough season from current month (Bangladesh style)
function getCurrentSeasonLabel() {
    const m = new Date().getMonth() + 1; // 1–12

    if (m >= 11 || m <= 2) return "Rabi (winter / dry season)";
    if (m >= 3 && m <= 6)  return "Pre-Kharif (pre-monsoon)";
    return "Kharif (monsoon)";
}

// Read farmer profile
function getFarmerProfile() {
    try {
        return JSON.parse(localStorage.getItem("krishibotFarmerProfile") || "{}");
    } catch (e) {
        return {};
    }
}

// Detect Bangla letters
function isBangla(str) {
    return /[\u0980-\u09FF]/.test(str || "");
}

function simpleBotReply(userText) {
    const t = userText.toLowerCase();
    const isBn = isBangla(userText); // auto detect Bangla input

    const profile = getFarmerProfile();
    const seasonLabel = getCurrentSeasonLabel();

    const name      = profile.fullName || "Farmer";
    const landArea  = profile.landArea || "your land";
    const soilType  = profile.soilType || "your soil";
    const location  = profile.location || "your area";

    let answer = "";

    /* -----------------------------
       BANGLA VERSION (auto triggered)
       ----------------------------- */
    if (isBn) {

        // Crop question
        if (
            userText.includes("কোন ফসল") ||
            userText.includes("ভালো ফসল") ||
            t.includes("which crop") || t.includes("best crop")
        ) {

            const variantsBn = [
                `${name}, বর্তমান মৌসুম (${seasonLabel}) এবং আপনার ${soilType} মাটিতে সাধারণত **আমন ধান, গম, সরিষা** এসব ফসল ${landArea}-এ ভালো ফলন দেয়। পরবর্তী ভার্সনে আমি আপনার এলাকার আবহাওয়া ও মাটির ডেটা বিশ্লেষণ করে নির্দিষ্ট ফসল সাজেস্ট করব।`,
                `${seasonLabel} মৌসুম আর ${soilType} মাটির জন্য সাধারণত **ধান, ভুট্টা, আলু** ভালো হয়। KrishiBoT এর AI সংস্করণ আপনার GPS লোকেশন ধরে আরও নির্ভুল সাজেশন দেবে।`,
                `${location} অঞ্চলে আপনার ${soilType} মাটিতে সাধারণভাবে **ধান, সরিষা, ডাল, সবজি** চাষ করা হয়। ভবিষ্যতে আমি ফসলভেদে ফলন, সময় ও সার ডোজ হিসাব করে দেব।`
            ];
            answer = variantsBn[Math.floor(Math.random() * variantsBn.length)];
        }

        // Temperature
        else if (userText.includes("তাপমাত্রা") || t.includes("temperature")) {
            answer = "তাপমাত্রা ফসলের বৃদ্ধি ও ফলনের জন্য খুব গুরুত্বপূর্ণ। বেশি ঠান্ডা হলে গাছ ধীরে বাড়ে, উপযুক্ত তাপমাত্রায় ফলন বেশি হয় এবং বেশি গরমে গাছ হিট-স্ট্রেসে পড়ে ফলন কমে যায়। ভবিষ্যতে KrishiBoT প্রতিটি ফসলের উপযোগী তাপমাত্রা দেখিয়ে পরামর্শ দেবে।";
        }

        // Fertilizer
        else if (userText.includes("সার") || t.includes("fertilizer")) {
            answer = "সারের পরিমাণ নির্ভর করে ফসল, মাটির ধরণ এবং জমির আয়তনের ওপর। মাটির পরীক্ষার রিপোর্ট অনুযায়ী N-P-K এর পরিমাণ নির্ধারণ করা হয়। ভবিষ্যতে KrishiBoT আপনার জমির তথ্য নিয়ে স্বয়ংক্রিয়ভাবে আদর্শ সার ডোজ হিসাব করে দেবে।";
        }

        // Fallback Bangla
        else {
            answer = "ধন্যবাদ! ভবিষ্যতে KrishiBoT আপনার প্রোফাইল, মাটির ধরন ও আবহাওয়ার তথ্য ব্যবহার করে আরও নির্ভুল কৃষি পরামর্শ দেবে।";
        }

        // Add detail
        if (kbSettings.responseStyle === "detailed") {
            answer += " এটি একটি প্রোটোটাইপ উত্তর। পূর্ণ সিস্টেমে আরও উন্নত তথ্য ব্যবহার করা হবে।";
        }

        // Tips
        if (kbSettings.showTips) {
            answer += " টিপস: আপনার প্রোফাইলে জমির সাইজ, মাটির ধরন ও সেচের ধরণ আপডেট রাখুন।";
        }

        return answer;
    }

    /* -----------------------------
       ORIGINAL ENGLISH VERSION (unchanged)
       ----------------------------- */

    if (t.includes("which crop") || t.includes("best crop")) {
        const variants = [
            `${name}, based on ${seasonLabel} and ${soilType}, crops like **Aman rice, wheat and mustard** are usually suitable for ${landArea}. In the full system I will check weather and soil data for ${location} and suggest an exact crop plan for you.`,
            `Considering the current season (${seasonLabel}) and your soil type (${soilType}), you can try **rice, maize or potato** on ${landArea}. Later the AI version will read from the crop database and rank the best options for your GPS location.`,
            `For ${landArea} with ${soilType} soil in ${location}, common choices are **rice, mustard, lentil and vegetables**. In the final RAG + SLM version I will search agronomy data and give you crop-wise yield, duration and fertilizer doses.`,
            `Right now I can give a simple idea: in ${seasonLabel} farmers in ${location} usually grow **rice, wheat, mustard and potato** on ${soilType} soil. Update your profile (land, soil, irrigation) so that future AI answers become more accurate for you.`
        ];
        answer = variants[Math.floor(Math.random() * variants.length)];
    }
    else if (t.includes("temperature")) {
        answer = "Temperature controls how fast crops grow and yield. Too low slows growth, an optimum range gives high yield, and too high causes heat stress, sterility and yield loss. In the AI version I will match each crop with its ideal temperature range from the crop database.";
    }
    else if (t.includes("fertilizer")) {
        answer = "Fertilizer dose depends on crop, soil type and land size. Typically we decide N-P-K based on soil test and recommended dose per bigha/acre. In the real system KrishiBoT will read your land area and soil type, then calculate N, P and K amounts for you.";
    }
    else {
        answer = "Thanks for your question. In the final AI version I will use crop knowledge (RAG + SLM) plus your profile, soil and weather data to generate a detailed, personalized answer for your land.";
    }

    if (kbSettings.responseStyle === "detailed") {
        answer += " This is a simple prototype reply. In the full system KrishiBoT will pull data from the crop database and weather API to refine this advice.";
    }

    if (kbSettings.showTips) {
        answer += " Tip: keep your farmer profile (location, land area, soil, irrigation) updated to improve recommendations.";
    }

    return answer;
}



/* 6.4 RENDERING (HISTORY + MAIN CHAT) */

// Render left-side conversation history list
function renderHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;

    list.innerHTML = "";

    kbConversations.forEach(conv => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.dataset.id = conv.id;

        const titleSpan = document.createElement("span");
        titleSpan.className = "history-title";
        titleSpan.textContent = conv.title || "Untitled chat";

        const delBtn = document.createElement("button");
        delBtn.className = "history-delete";
        delBtn.textContent = "✕";

        // DELETE conversation – also clear main area if open
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();

            kbConversations = kbConversations.filter(c => c.id !== conv.id);
            saveConversations();

            if (kbCurrentConversation && kbCurrentConversation.id === conv.id) {
                kbCurrentConversation = null;
                const wrapper = document.getElementById("chatWrapper");
                const empty   = document.getElementById("chatEmptyState");
                if (wrapper) wrapper.innerHTML = "";
                if (empty)   empty.style.display = "flex";
            }

            renderHistory();
        });

        // OPEN conversation
        item.addEventListener("click", () => {
            kbCurrentConversation = JSON.parse(JSON.stringify(conv));
            kbAnimateLastBot = false; // no animation when just loading old chat
            renderChat();
        });

        item.appendChild(titleSpan);
        item.appendChild(delBtn);
        list.appendChild(item);
    });
}

// Render chat messages in main area
function renderChat() {
    const wrapper = document.getElementById("chatWrapper");
    const empty   = document.getElementById("chatEmptyState");
    if (!wrapper) return;

    wrapper.innerHTML = "";

    if (!kbCurrentConversation || kbCurrentConversation.messages.length === 0) {
        if (empty) empty.style.display = "flex";
        return;
    }

    if (empty) empty.style.display = "none";

    const lastIndex = kbCurrentConversation.messages.length - 1;

    kbCurrentConversation.messages.forEach((msg, index) => {
        const bubble = document.createElement("div");
        bubble.className = msg.from === "user" ? "user-bubble" : "bot-bubble";

        const shouldAnimate =
            kbAnimateLastBot &&
            msg.from === "bot" &&
            index === lastIndex;

        if (shouldAnimate) {
            bubble.textContent = "";
            wrapper.appendChild(bubble);
            typeTextInBubble(bubble, msg.text);
        } else {
            bubble.textContent = msg.text;
            wrapper.appendChild(bubble);
        }
    });

    wrapper.scrollTop = wrapper.scrollHeight;
}


/* 6.5 SAVE SINGLE MESSAGE TO DB */

function saveChatMessageToDB(sender, text) {
    const farmerId = getCurrentFarmerId();
    if (!farmerId) {
        console.warn("No farmer id found, not saving chat to DB");
        return;
    }

    const formData = new FormData();
    formData.append("farmer_id", farmerId);
    formData.append("sender", sender);      // 'farmer' or 'bot'
    formData.append("message", text);

    fetch("backend/save_chat.php", {
        method: "POST",
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.status !== "success") {
                console.error("save_chat.php error:", data);
            }
        })
        .catch(err => {
            console.error("save_chat.php network error:", err);
        });
}


/* 6.6 HANDLE USER MESSAGE + INPUT BAR */

function handleUserMessage(text) {
    if (!kbCurrentConversation) {
        createNewConversation();
    }

    // 1) update UI + local convo
    kbCurrentConversation.messages.push({ from: "user", text });

    if (!kbCurrentConversation.title || kbCurrentConversation.title === "Chat") {
        kbCurrentConversation.title = titleFromText(text);
    }

    kbAnimateLastBot = false;   // do not animate old messages
    renderChat();
    saveConversations();

    // 2) save user message to DB
    saveChatMessageToDB("farmer", text);

    // 3) Ask backend AI for reply (with fallback to simpleBotReply)
    askBackendAI(text).then(data => {
        let reply;

        if (data && data.status === "success" && data.reply) {
            reply = data.reply;              // reply from backend/ai_chat.php
        } else {
            reply = simpleBotReply(text);    // fallback JS reply
        }

        kbAnimateLastBot = true;  // animate this bot message

        kbCurrentConversation.messages.push({ from: "bot", text: reply });
        renderChat();             // will show typing effect
        saveConversations();

        // save bot reply to DB
        saveChatMessageToDB("bot", reply);
    });
}

// Chat input + send button
function setupChatInput() {
    const input   = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    if (!input || !sendBtn) return;

    const send = () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        handleUserMessage(text);
    };

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });
}

// Quick suggestion buttons under sidebar
function setupSuggestions() {
    const container = document.getElementById("suggestList");
    if (!container) return;

    container.querySelectorAll("[data-question]").forEach(btn => {
        btn.addEventListener("click", () => {
            const q = btn.getAttribute("data-question");
            handleUserMessage(q);
        });
    });
}

// "New Chat" button
function setupNewChatButton() {
    const btn = document.getElementById("newChatBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
        // save current conversation into history list
        if (kbCurrentConversation && kbCurrentConversation.messages.length > 0) {
            kbConversations.unshift(kbCurrentConversation);
            saveConversations();
            renderHistory();
        }
        createNewConversation();
        renderChat();
    });
}

// Scroll-to-bottom button
function setupScrollButton() {
    const btn     = document.getElementById("scrollBtn");
    const wrapper = document.getElementById("chatWrapper");
    if (!btn || !wrapper) return;

    btn.addEventListener("click", () => {
        wrapper.scrollTop = wrapper.scrollHeight;
    });
}


/* 6.7 INIT CHAT PAGE + LOAD DB HISTORY */

function setupChatSystem() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "chat.html") return;

    const farmerId = getCurrentFarmerId();
    if (!farmerId) {
        alert("Not logged in.");
        window.location.href = "index.html";
        return;
    }

    // 🔑 make history key unique per farmer
    kbConversationKey = farmerId ? `kbConversations_${farmerId}` : "kbConversations_guest";

    // load previous chat messages from DB
    fetch(`backend/load_chat.php?farmer_id=${encodeURIComponent(farmerId)}`)
        .then(res => res.json())
        .then(data => {
            console.log("LOAD CHAT RESPONSE:", data);

            if (data.status === "success") {
                kbCurrentConversation = {
                    id: Date.now(),
                    title: "Chat",
                    messages: data.messages.map(msg => ({
                        from: msg.sender === "farmer" ? "user" : "bot",
                        message_id: msg.id,
                        text: msg.message_text
                    }))
                };
            } else {
                console.error("Chat load error:", data);
                createNewConversation();
            }

            kbAnimateLastBot = false;
            renderChat();
        })
        .catch(err => {
            console.error("Chat history fetch error:", err);
            createNewConversation();
            renderChat();
        });

    // local history for sidebar (per farmer)
    loadConversations();
    renderHistory();

    // input + helpers
    setupChatInput();
    setupSuggestions();
    setupNewChatButton();
    setupScrollButton();
}


/****************************************************
 * 7. SETTINGS PAGE LOGIC
 ****************************************************/

function setupSettingsPage() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "settings.html") return;

    // refresh global settings
    kbSettings = loadKrishiSettings();

    const panels = {
        system:    document.getElementById("settings-system"),
        chatbot:   document.getElementById("settings-chatbot"),
        interface: document.getElementById("settings-interface"),
        privacy:   document.getElementById("settings-privacy"),
        appdata:   document.getElementById("settings-appdata")
    };

    // menu switching
    const menuItems = document.querySelectorAll(".settings-menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            menuItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const section = item.dataset.section;
            Object.keys(panels).forEach(key => {
                panels[key].style.display = (key === section) ? "block" : "none";
            });
        });
    });

    // ----- SYSTEM PREFS -----
    const langSel   = document.getElementById("setLanguage");
    const adviceSel = document.getElementById("setAdviceMode");
    const unitsSel  = document.getElementById("setUnits");
    const sttChk    = document.getElementById("setVoiceSTT");
    const ttsChk    = document.getElementById("setVoiceTTS");
    const gpsChk    = document.getElementById("setUseGPS");

    if (langSel) {
        langSel.value   = kbSettings.language;
        adviceSel.value = kbSettings.adviceMode;
        unitsSel.value  = kbSettings.units;
        sttChk.checked  = kbSettings.voiceSTT;
        ttsChk.checked  = kbSettings.voiceTTS;
        gpsChk.checked  = kbSettings.useGPS;

        langSel.addEventListener("change",   () => { kbSettings.language   = langSel.value;   saveKrishiSettings(kbSettings); });
        adviceSel.addEventListener("change", () => { kbSettings.adviceMode = adviceSel.value; saveKrishiSettings(kbSettings); });
        unitsSel.addEventListener("change",  () => { kbSettings.units      = unitsSel.value;  saveKrishiSettings(kbSettings); });
        sttChk.addEventListener("change",    () => { kbSettings.voiceSTT   = sttChk.checked;  saveKrishiSettings(kbSettings); });
        ttsChk.addEventListener("change",    () => { kbSettings.voiceTTS   = ttsChk.checked;  saveKrishiSettings(kbSettings); });
        gpsChk.addEventListener("change",    () => { kbSettings.useGPS     = gpsChk.checked;  saveKrishiSettings(kbSettings); });
    }

    // ----- CHATBOT SETTINGS -----
    const respSel    = document.getElementById("setResponseStyle");
    const langAnsSel = document.getElementById("setAnswerLanguage");
    const tipsChk    = document.getElementById("setShowTips");

    if (respSel) {
        respSel.value    = kbSettings.responseStyle;
        langAnsSel.value = kbSettings.answerLanguage;
        tipsChk.checked  = kbSettings.showTips;

        respSel.addEventListener("change",    () => { kbSettings.responseStyle  = respSel.value;    saveKrishiSettings(kbSettings); });
        langAnsSel.addEventListener("change", () => { kbSettings.answerLanguage = langAnsSel.value; saveKrishiSettings(kbSettings); });
        tipsChk.addEventListener("change",    () => { kbSettings.showTips       = tipsChk.checked;  saveKrishiSettings(kbSettings); });
    }

    // ----- INTERFACE -----
    const themeSel = document.getElementById("setTheme");
    const densSel  = document.getElementById("setDensity");

    if (themeSel) {
        themeSel.value = kbSettings.theme;
        densSel.value  = kbSettings.density;

        themeSel.addEventListener("change", () => {
            kbSettings.theme = themeSel.value;
            saveKrishiSettings(kbSettings);

            if (kbSettings.theme === "dark") {
                document.body.style.background = "#1b1b1b";
            } else {
                document.body.style.background = "#edf6ee";
            }
        });

        densSel.addEventListener("change", () => {
            kbSettings.density = densSel.value;
            saveKrishiSettings(kbSettings);
        });

        // apply current theme
        if (kbSettings.theme === "dark") {
            document.body.style.background = "#1b1b1b";
        }
    }

    // ----- PRIVACY -----
    const saveHistChk = document.getElementById("setSaveHistory");
    const shareChk    = document.getElementById("setShareAnalytics");

    if (saveHistChk) {
        saveHistChk.checked = kbSettings.saveHistory;
        shareChk.checked    = kbSettings.shareAnalytics;

        saveHistChk.addEventListener("change", () => {
            kbSettings.saveHistory = saveHistChk.checked;
            saveKrishiSettings(kbSettings);
        });
        shareChk.addEventListener("change", () => {
            kbSettings.shareAnalytics = shareChk.checked;
            saveKrishiSettings(kbSettings);
        });
    }

    // ----- APP & DATA -----
    const btnClearHistory = document.getElementById("btnClearHistory");
    const btnResetProfile = document.getElementById("btnResetProfile");
    const btnResetAll     = document.getElementById("btnResetAll");

    // per-farmer history key here as well
    const farmerId = getCurrentFarmerId();
    const historyKey = farmerId ? `kbConversations_${farmerId}` : "kbConversations_guest";

    if (btnClearHistory) {
        btnClearHistory.addEventListener("click", () => {
            if (!confirm("Clear all saved chat history on this device for this farmer?")) return;
            localStorage.removeItem(historyKey);
            // also clear old global key if it exists
            localStorage.removeItem("kbConversations");
            alert("Chat history cleared.");
        });
    }

    if (btnResetProfile) {
        btnResetProfile.addEventListener("click", () => {
            if (!confirm("Reset stored farmer profile data?")) return;
            localStorage.removeItem("krishibotFarmerProfile");
            alert("Farmer profile data cleared.");
        });
    }

    if (btnResetAll) {
        btnResetAll.addEventListener("click", () => {
            if (!confirm("Reset all KrishiBoT data and logout?")) return;

            localStorage.removeItem("krishibotFarmerUser");
            localStorage.removeItem("krishibotFarmerProfile");
            localStorage.removeItem("krishibotFarmerLoggedIn");
            localStorage.removeItem("krishibotProfilePhoto");
            localStorage.removeItem("krishibotAdmin");
            localStorage.removeItem("krishibotAdminLoggedIn");
            localStorage.removeItem(historyKey);
            localStorage.removeItem("kbConversations");
            localStorage.removeItem("krishibotSettings");

            alert("All local data cleared. You will be redirected to login.");
            window.location.href = "index.html";
        });
    }
}


/****************************************************
 * 8. INIT – runs on every page after DOM is ready
 ****************************************************/


document.addEventListener("DOMContentLoaded", () => {
    applySavedProfilePhoto();
    setupProfileUpload();

    setupFarmerAuth();
    protectFarmerPages();
    setupFarmerLogout();
    setupRegisterAndProfileForms();

    setupAdminLoginPage();
    protectAdminPage();
    setupAdminLogout();

    setupSettingsPage();
    setupChatSystem();
});
