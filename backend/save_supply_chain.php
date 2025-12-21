<?php
header('Content-Type: application/json');
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo json_encode(["success" => false, "message" => "Invalid request method"]);
  exit;
}

$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
  echo json_encode(["success" => false, "message" => "Invalid JSON"]);
  exit;
}

$farmer_id = intval($data['farmer_id'] ?? 0);

$crop_name = trim($data['crop_name'] ?? '');
$location_district = trim($data['location_district'] ?? '');
$season = trim($data['season'] ?? '');

$quantity = floatval($data['quantity'] ?? 0);
$unit = trim($data['unit'] ?? 'kg');
$harvest_date = $data['harvest_date'] ?? null;

$storage_option = trim($data['storage_option'] ?? '');
$packaging = trim($data['packaging'] ?? '');
$target_buyer = trim($data['target_buyer'] ?? '');

$recommended_dispatch = trim($data['recommended_dispatch'] ?? '');
$risk_level = trim($data['risk_level'] ?? '');
$logistics_cost = floatval($data['logistics_cost'] ?? 0);

$steps_json = json_encode($data['steps'] ?? [], JSON_UNESCAPED_UNICODE);
$alerts_json = json_encode($data['alerts'] ?? [], JSON_UNESCAPED_UNICODE);
$cost_breakdown_json = json_encode($data['cost_breakdown'] ?? [], JSON_UNESCAPED_UNICODE);

if ($farmer_id <= 0 || $crop_name === '' || $location_district === '' || $season === '' || $quantity <= 0) {
  echo json_encode(["success" => false, "message" => "Missing required fields"]);
  exit;
}

if ($harvest_date === '' || $harvest_date === null) {
  $harvest_date = null;
}

$sql = "INSERT INTO supply_chain_plans
(farmer_id, crop_name, location_district, season, quantity, unit, harvest_date,
 storage_option, packaging, target_buyer,
 recommended_dispatch, risk_level, logistics_cost,
 steps_json, alerts_json, cost_breakdown_json)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  echo json_encode(["success" => false, "message" => "Prepare failed"]);
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
  echo json_encode(["success" => false, "message" => "DB insert failed"]);
  $stmt->close();
  exit;
}

echo json_encode([
  "success" => true,
  "message" => "Supply chain plan saved",
  "plan_id" => $stmt->insert_id
]);

$stmt->close();
$conn->close();
