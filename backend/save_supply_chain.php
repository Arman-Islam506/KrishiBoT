<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

/* -------------------------
   Only POST allowed
------------------------- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo json_encode([
    "success" => false,
    "message" => "Invalid request method"
  ]);
  exit;
}

/* -------------------------
   Read JSON input
------------------------- */
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
  echo json_encode([
    "success" => false,
    "message" => "Invalid JSON payload"
  ]);
  exit;
}

/* -------------------------
   Normalize fields (JS → DB)
------------------------- */
$farmer_id = intval($data['farmer_id'] ?? 0);

$crop_name = trim($data['crop_name'] ?? $data['crop'] ?? '');
$location_district = trim($data['location_district'] ?? $data['location'] ?? '');
$season = trim($data['season'] ?? '');

$quantity = floatval($data['quantity'] ?? $data['qty'] ?? 0);
$unit = trim($data['unit'] ?? 'kg');
$harvest_date = $data['harvestDate'] ?? $data['harvest_date'] ?? null;

$storage_option = trim($data['storage_option'] ?? $data['storage'] ?? '');
$packaging = trim($data['packaging'] ?? '');
$target_buyer = trim($data['target_buyer'] ?? $data['buyer'] ?? '');

$recommended_dispatch = trim($data['recommended_dispatch'] ?? '');
$risk_level = trim($data['risk_level'] ?? '');
$logistics_cost = floatval($data['logistics_cost'] ?? 0);

/* -------------------------
   JSON fields
------------------------- */
$steps_json = json_encode($data['steps'] ?? [], JSON_UNESCAPED_UNICODE);
$alerts_json = json_encode($data['alerts'] ?? [], JSON_UNESCAPED_UNICODE);
$cost_breakdown_json = json_encode($data['cost_breakdown'] ?? [], JSON_UNESCAPED_UNICODE);

/* -------------------------
   Validation
------------------------- */
if (
  $farmer_id <= 0 ||
  $crop_name === '' ||
  $location_district === '' ||
  $season === '' ||
  $quantity <= 0
) {
  echo json_encode([
    "success" => false,
    "message" => "Missing or invalid required fields"
  ]);
  exit;
}

if ($harvest_date === '' || $harvest_date === null) {
  $harvest_date = null;
}

/* -------------------------
   Insert into database
------------------------- */
$sql = "
INSERT INTO supply_chain_plans
(
  farmer_id,
  crop_name,
  location_district,
  season,
  quantity,
  unit,
  harvest_date,
  storage_option,
  packaging,
  target_buyer,
  recommended_dispatch,
  risk_level,
  logistics_cost,
  steps_json,
  alerts_json,
  cost_breakdown_json
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
  echo json_encode([
    "success" => false,
    "message" => "Prepare failed",
    "error" => $conn->error
  ]);
  exit;
}

$stmt->bind_param(
  "isssdsssssssdsss",
  $farmer_id,
  $crop_name,
  $location_district,
  $season,
  $quantity,
  $unit,
  $harvest_date,
  $storage_option,
  $packaging,
  $target_buyer,
  $recommended_dispatch,
  $risk_level,
  $logistics_cost,
  $steps_json,
  $alerts_json,
  $cost_breakdown_json
);

if (!$stmt->execute()) {
  echo json_encode([
    "success" => false,
    "message" => "Database insert failed",
    "error" => $stmt->error
  ]);
  $stmt->close();
  exit;
}

/* -------------------------
   Success response
------------------------- */
echo json_encode([
  "success" => true,
  "message" => "Supply chain plan saved successfully",
  "plan_id" => $stmt->insert_id
]);

$stmt->close();
$conn->close();
