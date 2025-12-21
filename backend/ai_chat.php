<?php
// backend/ai_chat.php

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

function respond($arr, $code = 200) {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Catch fatal errors and still return JSON (fixes "Unexpected end of JSON input")
 */
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'status' => 'error',
            'reply'  => 'Server error in ai_chat.php',
            'debug'  => [
                'type' => $err['type'],
                'msg'  => $err['message'],
                'file' => basename($err['file']),
                'line' => $err['line'],
            ]
        ], JSON_UNESCAPED_UNICODE);
    }
});

/* ====== CONFIG (Gemini optional) ====== */
$GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; // put your real key here
$GEMINI_MODEL   = 'gemini-1.5-flash';

/* ====== POST only ====== */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(['status' => 'error', 'reply' => 'POST only'], 405);
}

/* ====== Read message + farmer_id (FormData OR JSON) ====== */
$message  = '';
$farmerId = null;

// FormData
if (isset($_POST['message'])) {
    $message = trim((string)$_POST['message']);
    $farmerId = $_POST['farmer_id'] ?? null;
}

// JSON fallback
if ($message === '') {
    $raw = file_get_contents("php://input");
    if ($raw) {
        $body = json_decode($raw, true);
        if (is_array($body)) {
            $message  = trim((string)($body['message'] ?? ''));
            $farmerId = $body['farmer_id'] ?? null;
        }
    }
}

if ($message === '') {
    respond(['status' => 'error', 'reply' => 'Please type a question.'], 400);
}

$farmerId = ($farmerId !== null && $farmerId !== '') ? (int)$farmerId : null;

/* ====== DB connect ====== */
require __DIR__ . "/db.php";
if (!isset($conn) || !$conn) {
    respond(['status' => 'error', 'reply' => 'Database connection not available.'], 500);
}

/* ====== Helpers ====== */
function isBangla($t) {
    return preg_match('/[\x{0980}-\x{09FF}]/u', $t) === 1;
}

function currentSeasonEn() {
    $m = (int)date('n');
    if ($m >= 11 || $m <= 2) return "Rabi (Winter)";
    if ($m >= 3 && $m <= 6)  return "Pre-Kharif (Summer)";
    return "Kharif (Monsoon)";
}
function currentSeasonBn() {
    $m = (int)date('n');
    if ($m >= 11 || $m <= 2) return "রবি মৌসুম (শীতকাল)";
    if ($m >= 3 && $m <= 6)  return "খরিফ-১ (গ্রীষ্মকাল)";
    return "খরিফ-২ (বর্ষা/আমন মৌসুম)";
}

function seasonLikePatterns($seasonEn) {
    $s = strtolower($seasonEn);
    if (strpos($s, 'rabi') !== false) return ['%Rabi%'];
    if (strpos($s, 'pre-kharif') !== false) return ['%Pre-Kharif%','%Summer%'];
    return ['%Kharif%','%Monsoon%','%Aman%'];
}

function fetchAllCrops($conn, $seasonEn, $soil, $limit = 8) {
    $likes = seasonLikePatterns($seasonEn);

    $parts = [];
    foreach ($likes as $x) $parts[] = "season LIKE ?";
    $seasonWhere = implode(" OR ", $parts);

    if ($soil) {
        $sql = "SELECT crop_name, season, soil_type
                FROM crops
                WHERE ($seasonWhere)
                  AND (soil_type = ? OR soil_type LIKE ?)
                ORDER BY crop_name ASC
                LIMIT ?";
    } else {
        $sql = "SELECT crop_name, season, soil_type
                FROM crops
                WHERE ($seasonWhere)
                ORDER BY crop_name ASC
                LIMIT ?";
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) return [];

    // bind params dynamically (no get_result)
    $params = [];
    $types  = str_repeat("s", count($likes));
    foreach ($likes as $v) $params[] = $v;

    if ($soil) {
        $types .= "ssi";
        $soilLike = "%".$soil."%";
        $params[] = $soil;
        $params[] = $soilLike;
        $params[] = (int)$limit;
    } else {
        $types .= "i";
        $params[] = (int)$limit;
    }

    $bind = [];
    $bind[] = $types;
    for ($i = 0; $i < count($params); $i++) $bind[] = &$params[$i];
    call_user_func_array([$stmt, 'bind_param'], $bind);

    if (!$stmt->execute()) return [];
    
    
    $crop_name = '';
    $season = '';
    $soil_type = '';

    $stmt->bind_result($crop_name, $season, $soil_type);

    $rows = [];
    while ($stmt->fetch()) {
        $rows[] = [
            'crop_name' => $crop_name,
            'season'    => $season,
            'soil_type' => $soil_type
        ];
    }
    $stmt->close();
    return $rows;
}

function rule_based_reply($msg, $isBn) {
    $lower = mb_strtolower($msg, 'UTF-8');

    $fertBn = ['সার', 'ইউরিয়া', 'টিএসপি', 'এমওপি', 'সারের ডোজ'];
    $fertEn = ['fertilizer', 'npk', 'urea', 'tsp', 'mop', 'dose'];

    $matchFert = false;
    if ($isBn) { foreach ($fertBn as $k) if (mb_strpos($lower, $k) !== false) { $matchFert = true; break; } }
    else { foreach ($fertEn as $k) if (stripos($msg, $k) !== false) { $matchFert = true; break; } }

    if ($matchFert) {
        return $isBn
            ? "• সার নির্ভর করে ফসল, মাটি ও জমির আকারের উপর\n• মাটির পরীক্ষা থাকলে রিপোর্ট অনুযায়ী ডোজ ঠিক করুন\n• নির্দিষ্ট ফসলের NPK চার্ট স্থানীয় কৃষি অফিস/DAE থেকে নিন"
            : "• Fertilizer depends on crop, soil and land size\n• Soil test helps adjust dose\n• Get official NPK chart from local agriculture office/DAE";
    }

    $waterBn = ['সেচ', 'পানি', 'জল'];
    $waterEn = ['water', 'irrigation', 'how much water'];

    $matchWater = false;
    if ($isBn) { foreach ($waterBn as $k) if (mb_strpos($lower, $k) !== false) { $matchWater = true; break; } }
    else { foreach ($waterEn as $k) if (stripos($msg, $k) !== false) { $matchWater = true; break; } }

    if ($matchWater) {
        return $isBn
            ? "• সেচের পরিমাণ ফসল+মাটি+আবহাওয়ার উপর নির্ভর করে\n• বেলে মাটিতে ঘন ঘন অল্প সেচ, দোআঁশে ব্যবধান বেশি\n• পানি জমে থাকলে রোগ বাড়ে—এড়িয়ে চলুন"
            : "• Water need depends on crop + soil + weather\n• Sandy soils need frequent light irrigations, loamy soils wider intervals\n• Avoid waterlogging to reduce disease risk";
    }

    return null;
}

/* ====== Farmer Profile (required for personalization) ====== */
if (!$farmerId) {
    respond([
        'status' => 'success',
        'reply'  => '⚠️ farmer_id missing. Please login/select a profile first.'
    ]);
}

$stmt = $conn->prepare("SELECT name, location, land_area, soil_type, irrigation_type
                        FROM farmers WHERE id = ? LIMIT 1");
if (!$stmt) {
    respond(['status'=>'error','reply'=>'Farmer profile query failed.'], 500);
}
$stmt->bind_param("i", $farmerId);
$stmt->execute();
$stmt->bind_result($p_name, $p_location, $p_land_area, $p_soil_type, $p_irrigation);
$hasRow = $stmt->fetch();
$stmt->close();

if (!$hasRow) {
    respond(['status'=>'success','reply'=>'⚠️ Farmer profile not found.']);
}

$p_name       = (string)$p_name;
$p_location   = (string)$p_location;
$p_land_area  = (string)$p_land_area;
$p_soil_type  = (string)$p_soil_type;
$p_irrigation = (string)$p_irrigation;

if ($p_location === '' || $p_land_area === '' || $p_soil_type === '') {
    respond([
        'status'=>'success',
        'reply'=>'⚠️ Your profile is incomplete. Please update Location, Land size, and Soil type in Profile section.'
    ]);
}

/* ====== Intent detect ====== */
$isBn = isBangla($message);
$msgLower = mb_strtolower($message, 'UTF-8');

$cropIntent = false;
if ($isBn) {
    if (mb_strpos($msgLower,'ফসল') !== false || mb_strpos($msgLower,'চাষ') !== false) $cropIntent = true;
} else {
    if (stripos($message,'crop') !== false || stripos($message,'best crop') !== false || stripos($message,'which crop') !== false) $cropIntent = true;
}

/* ====== 1) Crop from DB (profile-based) ====== */
if ($cropIntent) {
    $seasonEn = currentSeasonEn();
    $soil = trim($p_soil_type);

    $crops = fetchAllCrops($conn, $seasonEn, $soil, 8);
    if (empty($crops)) $crops = fetchAllCrops($conn, $seasonEn, null, 8);

    if (!empty($crops)) {
        if ($isBn) {
            $out  = "✅ প্রোফাইল অনুযায়ী ডাটাবেস থেকে ফসল পরামর্শ:\n";
            $out .= "• কৃষক: {$p_name}\n";
            $out .= "• এলাকা: {$p_location}\n";
            $out .= "• জমি: {$p_land_area} একর\n";
            $out .= "• মাটি: {$p_soil_type}\n";
            $out .= "• মৌসুম: ".currentSeasonBn()."\n\n";
            foreach ($crops as $c) $out .= "• {$c['crop_name']} (মৌসুম: {$c['season']})\n";
            respond(['status'=>'success','reply'=>$out]);
        } else {
            $out  = "✅ Personalized crop recommendation (from DB):\n";
            $out .= "👨‍🌾 Farmer: {$p_name}\n";
            $out .= "📍 Location: {$p_location}\n";
            $out .= "📐 Land size: {$p_land_area} Acre\n";
            $out .= "🌱 Soil type: {$p_soil_type}\n";
            $out .= "🌦 Season: ".currentSeasonEn()."\n\n";
            foreach ($crops as $c) $out .= "• {$c['crop_name']} ({$c['season']})\n";
            respond(['status'=>'success','reply'=>$out]);
        }
    }

    respond([
        'status'=>'success',
        'reply'=> $isBn
            ? "ডাটাবেসে আপনার মাটি/মৌসুম অনুযায়ী ফসল পাওয়া যায়নি। Soil type (Loamy/Sandy/Clay) ঠিক করে আবার চেষ্টা করুন।"
            : "No crop match found for your soil/season. Please verify Soil type (Loamy/Sandy/Clay) and try again."
    ]);
}

/* ====== 2) Rule-based ====== */
$rb = rule_based_reply($message, $isBn);
if ($rb !== null) {
    respond(['status'=>'success','reply'=>$rb]);
}

/* ====== 3) Gemini fallback (optional) ====== */
if (!$GEMINI_API_KEY || $GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    respond([
        'status'=>'success',
        'reply'=> $isBn
            ? "⚠️ Gemini API key সেট করা নেই। এখন আমি শুধু ডাটাবেস/রুল-বেসড উত্তর দিতে পারি।"
            : "⚠️ Gemini API key not configured. I can answer only using database/rule-based logic right now."
    ]);
}

$systemPrompt = $isBn
    ? "তুমি KrishiBoT — বাংলাদেশের কৃষকের জন্য AI কৃষি সহকারী। ৩–৬ লাইনে বাস্তব পরামর্শ দেবে। শুধু কৃষি বিষয়ে কথা বলবে।"
    : "You are KrishiBoT, an AI crop advisory assistant for farmers in Bangladesh. Answer in 3–6 lines with practical farming advice only.";

$context = "Farmer profile: Name={$p_name}; Location={$p_location}; Land={$p_land_area}; Soil={$p_soil_type}; Irrigation={$p_irrigation}. ";
$userPrompt = $context . "Question: " . $message;

$payload = [
    'contents' => [[
        'parts' => [[ 'text' => $systemPrompt . "\n\n" . $userPrompt ]]
    ]]
];

$url = "https://generativelanguage.googleapis.com/v1beta/models/{$GEMINI_MODEL}:generateContent?key={$GEMINI_API_KEY}";

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT        => 25
]);

$response = curl_exec($ch);
if ($response === false) {
    respond(['status'=>'error','reply'=>'Curl error: '.curl_error($ch)], 500);
}
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode < 200 || $httpCode >= 300) {
    respond(['status'=>'error','reply'=>'Gemini HTTP error: '.$httpCode], 500);
}

$data = json_decode($response, true);
$replyText = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

if (!$replyText) {
    respond(['status'=>'error','reply'=>'No reply from Gemini'], 500);
}

respond(['status'=>'success','reply'=>$replyText]);
