<?php
// backend/marketplace_analyze.php

header("Content-Type: application/json; charset=utf-8");

// Allow POST from same server (optional)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Use POST"]);
    exit;
}

require_once __DIR__ . "/db.php";

/* -------------------------
   1) Read input (supports JSON or normal form POST)
-------------------------- */
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$crop = trim(($data["cropName"] ?? $_POST["cropName"] ?? ""));
$location = trim(($data["location"] ?? $_POST["location"] ?? ""));
$season = trim(($data["season"] ?? $_POST["season"] ?? "auto"));

if ($season === "auto" || $season === "") {
    $season = detectSeason();
}

if ($crop === "" || $location === "") {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "cropName and location are required"]);
    exit;
}

/* -------------------------
   2) Try DB lookup (if you have a table)
   Table suggestion:
   marketplace_prices(crop, district, season, price_min, price_max, demand, best_time, updated_at)
-------------------------- */
try {
    $row = dbLookup($pdo, $crop, $location, $season);

    if ($row) {
        echo json_encode([
            "status" => "success",
            "source" => "database",
            "input" => ["crop" => $crop, "location" => $location, "season" => $season],
            "result" => [
                "priceMin" => (int)$row["price_min"],
                "priceMax" => (int)$row["price_max"],
                "demand"   => $row["demand"],
                "bestTime" => $row["best_time"],
                "advice"   => buildAdvice($crop, $location, $season, (int)$row["price_min"], (int)$row["price_max"], $row["demand"], $row["best_time"], "database")
            ]
        ]);
        exit;
    }
} catch (Throwable $e) {
    // If DB table doesn't exist yet or query fails, just fallback safely
}

/* -------------------------
   3) Fallback: prototype rule-based engine (same vibe as your JS)
-------------------------- */
$result = mockMarketAnalysis($crop, $location, $season);

echo json_encode([
    "status" => "success",
    "source" => "prototype_rules",
    "input" => ["crop" => $crop, "location" => $location, "season" => $season],
    "result" => $result
]);

/* =========================
   Helper functions
========================= */

function detectSeason(): string {
    $m = (int)date("n"); // 1..12
    // Rabi: Nov–Mar, Kharif-1: Apr–Jun, Kharif-2: Jul–Oct
    if ($m >= 11 || $m <= 3) return "Rabi";
    if ($m >= 4 && $m <= 6) return "Kharif-1";
    return "Kharif-2";
}

function normalizeText(string $s): string {
    $s = mb_strtolower(trim($s), "UTF-8");
    $s = preg_replace("/\s+/", " ", $s);
    return $s ?? "";
}

function dbLookup(PDO $pdo, string $crop, string $district, string $season): ?array {
    // Normalize for matching
    $cropN = normalizeText($crop);
    $distN = normalizeText($district);
    $seasonN = normalizeText($season);

    $sql = "SELECT crop, district, season, price_min, price_max, demand, best_time
            FROM marketplace_prices
            WHERE LOWER(crop) = :crop
              AND LOWER(district) = :district
              AND LOWER(season) = :season
            ORDER BY updated_at DESC
            LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ":crop" => $cropN,
        ":district" => $distN,
        ":season" => $seasonN
    ]);

    $row = $stmt->fetch();
    return $row ?: null;
}

function mockMarketAnalysis(string $crop, string $location, string $season): array {
    $cropKey = normalizeText($crop);
    $locKey  = normalizeText($location);

    // Base (demo)
    $baseMin = 40; $baseMax = 55; $demand = "Medium";

    if (str_contains($cropKey, "rice") || str_contains($cropKey, "ধান")) {
        $baseMin = 45; $baseMax = 60; $demand = "High";
    } elseif (str_contains($cropKey, "potato") || str_contains($cropKey, "আলু")) {
        $baseMin = 25; $baseMax = 40; $demand = "Medium";
    } elseif (str_contains($cropKey, "tomato") || str_contains($cropKey, "টমেটো")) {
        $baseMin = 35; $baseMax = 65; $demand = "High";
    } elseif (str_contains($cropKey, "onion") || str_contains($cropKey, "পেঁয়াজ") || str_contains($cropKey, "পিঁয়াজ")) {
        $baseMin = 60; $baseMax = 90; $demand = "High";
    }

    // Season factor
    $seasonFactor = 0;
    if ($season === "Rabi") $seasonFactor = 5;
    if ($season === "Kharif-2") $seasonFactor = 3;

    // Location factor (very light demo)
    $locFactor = 0;
    if (str_contains($locKey, "dhaka") || str_contains($locKey, "ঢাকা")) $locFactor = 4;
    if (str_contains($locKey, "chattogram") || str_contains($locKey, "ctg") || str_contains($locKey, "চট্টগ্রাম")) $locFactor = 3;

    $rand = fn() => random_int(0, 3);

    $priceMin = $baseMin + $seasonFactor + $locFactor + $rand();
    $priceMax = $baseMax + $seasonFactor + $locFactor + $rand();

    $bestTime = "Next 1–2 weeks";
    if ($demand === "High") $bestTime = "Next 2–3 weeks";
    if ($season === "Rabi") $bestTime = "Within next 7–14 days";

    $advice = buildAdvice($crop, $location, $season, $priceMin, $priceMax, $demand, $bestTime, "prototype");

    return [
        "priceMin" => $priceMin,
        "priceMax" => $priceMax,
        "demand"   => $demand,
        "bestTime" => $bestTime,
        "advice"   => $advice
    ];
}

function buildAdvice(string $crop, string $location, string $season, int $min, int $max, string $demand, string $bestTime, string $source): string {
    $srcLine = $source === "database"
        ? "✅ Estimated range is from stored marketplace dataset (DB)."
        : "✅ Estimated range is based on a prototype rule-set (demo).";

    return
        "📍 Location: {$location}\n" .
        "🌾 Crop: {$crop}\n" .
        "🗓️ Season: {$season}\n" .
        "💰 Price: {$min} - {$max} ৳/kg\n" .
        "📈 Demand: {$demand}\n" .
        "⏳ Best time: {$bestTime}\n\n" .
        $srcLine . "\n" .
        "• Grade/sort produce before selling\n" .
        "• Avoid selling immediately after harvest if market supply is very high\n" .
        "• Consider proper storage/packaging to reduce damage and increase value\n\n" .
        "Next upgrade: connect to dataset + AI model for real market trends.";
}
