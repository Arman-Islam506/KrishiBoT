<?php
header('Content-Type: application/json; charset=utf-8');

$apiKey = 'YOUR_GEMINI_API_KEY_HERE';      // <-- CHANGE THIS
$model  = 'gemini-1.5-flash';              // free-tier friendly model

// 1) Read input
// ------------------------------------------------------
$message  = isset($_POST['message']) ? trim($_POST['message']) : '';
$farmerId = isset($_POST['farmer_id']) ? trim($_POST['farmer_id']) : null;

require "db.php";

$farmerProfile = null;
if ($farmerId) {
    $stmt = $conn->prepare("
        SELECT name, location, land_area, soil_type, irrigation_type, preferred_language
        FROM farmers
        WHERE id = ?
    ");
    $stmt->bind_param("i", $farmerId);
    $stmt->execute();
    $farmerProfile = $stmt->get_result()->fetch_assoc();
}


if ($message === '') {
    echo json_encode([
        'status' => 'error',
        'reply'  => 'Please type a question.'
    ]);
    exit;
}

// ---------- Helpers ----------

function isBangla($t) {
    return preg_match('/[\x{0980}-\x{09FF}]/u', $t) === 1;
}

function currentSeasonBn() {
    $m = intval(date('n'));
    if ($m >= 11 || $m <= 2) return "রবি মৌসুম (শীতকাল)";
    if ($m >= 3 && $m <= 6)  return "খরিফ-১ (গ্রীষ্মকাল)";
    return "খরিফ-২ (বর্ষা/আমান মৌসুম)";
}

function currentSeasonEn() {
    $m = intval(date('n'));
    if ($m >= 11 || $m <= 2) return "Rabi (winter) season";
    if ($m >= 3 && $m <= 6)  return "Kharif-1 (pre-monsoon/summer)";
    return "Kharif-2 (monsoon/Aman season)";
}

/**
 * Simple rule-based reply for the most common farmer questions.
 * If we can answer from here → return string.
 * If not → return null and let the LLM (Gemini) handle it.
 */
function rule_based_reply($msg, $isBn) {
    $lower = mb_strtolower($msg, 'UTF-8');

    // ---- 1) Crop recommendation ----
    $cropKeywordsBn = ['কোন ফসল', 'কি ফসল', 'ফসল চাষ', 'চাষ করা ভালো', 'ফসল ভাল'];
    $cropKeywordsEn = ['which crop', 'best crop', 'what crop', 'crop is best'];

    $matchCrop = false;
    if ($isBn) {
        foreach ($cropKeywordsBn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchCrop = true; break; }
        }
    } else {
        foreach ($cropKeywordsEn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchCrop = true; break; }
        }
    }

    if ($matchCrop) {
        if ($isBn) {
            $season = currentSeasonBn();
            return "• এখন মৌসুম: {$season}\n"
                 . "• উপযুক্ত ফসল: ধান (আমন/বোরো), গম, সরিষা, মসুর, ভুট্টা ও বিভিন্ন সবজি\n"
                 . "• জমির পরামর্শ: জমি ভালোভাবে চাষ করে মাটি ঝুরঝুরে করুন, আগাছা পরিষ্কার করুন\n"
                 . "• সেচ/সারের পরামর্শ: ফসল অনুযায়ী পরিমিত সেচ দিন এবং সুপারিশকৃত ইউরিয়া, টিএসপি, এমওপি ব্যবহার করুন";
        } else {
            $season = currentSeasonEn();
            return "• Season: {$season}\n"
                 . "• Suitable crops: rice, wheat, mustard, lentil, maize and seasonal vegetables\n"
                 . "• Land preparation: plough 1–2 times, keep soil fine and remove weeds\n"
                 . "• Fertilizer/Irrigation: apply recommended NPK dose and give light irrigation as needed";
        }
    }

    // ---- 2) Fertilizer questions ----
    $fertBn = ['সার', 'ইউরিয়া', 'টিএসপি', 'এমওপি', 'সারের ডোজ'];
    $fertEn = ['fertilizer', 'npk', 'urea', 'tsp', 'mop', 'dose'];

    $matchFert = false;
    if ($isBn) {
        foreach ($fertBn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchFert = true; break; }
        }
    } else {
        foreach ($fertEn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchFert = true; break; }
        }
    }

    if ($matchFert) {
        if ($isBn) {
            return "• সার নির্ভর করে ফসল, মাটি ও জমির আকারের উপর\n"
                 . "• সাধারণভাবে প্রতি বিঘা/একর হিসেবে ইউরিয়া, টিএসপি, এমওপি নির্ধারিত ডোজ আছে\n"
                 . "• মাটির পরীক্ষা থাকলে সেই রিপোর্ট অনুযায়ী ডোজ কম–বেশি করতে হয়\n"
                 . "• কাছের কৃষি অফিস থেকে নির্দিষ্ট ফসল ও জমির আকার অনুযায়ী সারের চার্ট সংগ্রহ করুন";
        } else {
            return "• Fertilizer depends on crop, soil fertility and land size\n"
                 . "• NPK dose is usually recommended per bigha/acre from official charts\n"
                 . "• Soil test reports help increase or decrease the standard dose\n"
                 . "• Contact local agriculture office for exact NPK chart for your crop and area";
        }
    }

    // ---- 3) Water / irrigation questions ----
    $waterBn = ['সেচ', 'পানি', 'জল'];
    $waterEn = ['water', 'irrigation', 'how much water'];

    $matchWater = false;
    if ($isBn) {
        foreach ($waterBn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchWater = true; break; }
        }
    } else {
        foreach ($waterEn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchWater = true; break; }
        }
    }

    if ($matchWater) {
        if ($isBn) {
            return "• সেচের পরিমাণ নির্ভর করে ফসল, মাটি ও আবহাওয়ার উপর\n"
                 . "• বেলে মাটিতে ঘন ঘন অল্প সেচ, দোআঁশ মাটিতে একটু বেশি ব্যবধান রাখা যায়\n"
                 . "• ধান জাতের ফসলের জন্য বেশি পানি, গম/সরিষায় কম পানি লাগে\n"
                 . "• সবসময় জমিতে অতিরিক্ত পানি জমে থাকা এড়িয়ে চলুন";
        } else {
            return "• Water requirement depends on crop, soil type and weather\n"
                 . "• Sandy soils need frequent light irrigations, loamy soils can have wider intervals\n"
                 . "• Rice needs more standing water, wheat/mustard require much less\n"
                 . "• Avoid continuous waterlogging to prevent root and disease problems";
        }
    }

    // ---- 4) Temperature/general theory ----
    $tempBn = ['তাপমাত্রা', 'গরম', 'ঠান্ডা'];
    $tempEn = ['temperature', 'heat', 'cold'];

    $matchTemp = false;
    if ($isBn) {
        foreach ($tempBn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchTemp = true; break; }
        }
    } else {
        foreach ($tempEn as $k) {
            if (mb_strpos($lower, $k) !== false) { $matchTemp = true; break; }
        }
    }

    if ($matchTemp) {
        if ($isBn) {
            return "• তাপমাত্রা খুব কম হলে গাছের বৃদ্ধি ধীরে হয় ও ফুল আসতে দেরি হয়\n"
                 . "• উপযুক্ত তাপমাত্রায় গাছ ভালোভাবে বেড়ে ফলন বেশি দেয়\n"
                 . "• খুব বেশি গরমে গাছ হিট স্ট্রেসে ভোগে, ফুল ঝরে ও ফলন কমে যায়\n"
                 . "• ফসলের জন্য নির্দিষ্ট তাপমাত্রার পরিসর থাকে, সে অনুযায়ী ফসল নির্বাচন করা উচিত";
        } else {
            return "• Very low temperature slows crop growth and delays flowering\n"
                 . "• At optimum temperature plants grow fast with high yield\n"
                 . "• Excessive heat causes heat stress, flower drop and yield loss\n"
                 . "• Each crop has its own ideal temperature range; match crop with local climate";
        }
    }

    // No rule matched → let LLM handle it
    return null;
}

// --------------------------------------------------
// 2) First try RULE-BASED reply (for clean Bangla/English)
// --------------------------------------------------
$isBn = isBangla($message);
$rb  = rule_based_reply($message, $isBn);

if ($rb !== null) {
    echo json_encode([
        'status' => 'success',
        'reply'  => $rb
    ]);
    exit;
}

// --------------------------------------------------
// 3) If no rule matched → try Gemini cloud AI
//     If Gemini not configured / fails → let frontend
//     fallback to simpleBotReply() by returning status:error
// --------------------------------------------------

// If API key not set properly → signal error so JS fallback runs
if (!$apiKey || $apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gemini API key not configured'
    ]);
    exit;
}

// Build base system prompt
if ($isBn) {
    $systemPrompt =
        "তুমি KrishiBoT — বাংলাদেশের কৃষকের জন্য তৈরি AI ভিত্তিক ফসল পরামর্শ সহকারী। ".
        "সহজ, পরিষ্কার এবং গ্রামবাংলার ভাষায় উত্তর দেবে। সর্বোচ্চ ৩–৪ লাইনে বাস্তব পরামর্শ দেবে। ".
        "শুধু কৃষি বিষয় যেমন ফসল নির্বাচন, সার ডোজ, সেচ, জমি প্রস্তুতি, রোগ-পোকা ইত্যাদি নিয়ে কথা বলবে। ".
        "অপ্রয়োজনীয় গল্প, দর্শন বা রাজনৈতিক/ধর্মীয় আলোচনা করবে না।";
} else {
    $systemPrompt =
        "You are KrishiBoT, an AI-based crop advisory assistant for farmers in Bangladesh. ".
        "Give short (3–4 lines), practical advice about crops, soil, fertilizer, irrigation and pests. ".
        "Focus only on agriculture. Avoid politics, religion or unrelated topics.";
}

// Optional context if you later fetch farmer profile by $farmerId
$context = "";
if (!empty($farmerId)) {
    $context .= "Farmer ID: {$farmerId}. ";
}

$userPrompt = $context . "Farmer question: " . $message;

$payload = [
    'contents' => [
        [
            'parts' => [
                [ 'text' => $systemPrompt . "\n\n" . $userPrompt ]
            ]
        ]
    ]
];

$url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 20
]);

$response = curl_exec($ch);

if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);

    echo json_encode([
        'status'  => 'error',
        'message' => 'Curl error: ' . $err
    ]);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode < 200 || $httpCode >= 300) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gemini HTTP error: ' . $httpCode
    ]);
    exit;
}

$data = json_decode($response, true);

$replyText = null;
if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
    $replyText = $data['candidates'][0]['content']['parts'][0]['text'];
}

// If no reply from model → let frontend fallback
if (!$replyText) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'No reply from Gemini'
    ]);
    exit;
}

// Success → frontend will use this answer
echo json_encode([
    'status' => 'success',
    'reply'  => $replyText
]);
