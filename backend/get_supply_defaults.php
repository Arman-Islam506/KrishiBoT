<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$crop = trim($_GET['crop'] ?? '');
$district = trim($_GET['district'] ?? '');

if ($crop === '' || $district === '') {
  echo json_encode(["success"=>false, "message"=>"crop and district required"]);
  exit;
}

$stmt1 = $conn->prepare("SELECT * FROM sc_crop_profiles WHERE crop_name = ? LIMIT 1");
$stmt1->bind_param("s", $crop);
$stmt1->execute();
$cropRow = $stmt1->get_result()->fetch_assoc();
$stmt1->close();

$stmt2 = $conn->prepare("SELECT * FROM sc_district_factors WHERE district = ? LIMIT 1");
$stmt2->bind_param("s", $district);
$stmt2->execute();
$distRow = $stmt2->get_result()->fetch_assoc();
$stmt2->close();

if (!$cropRow || !$distRow) {
  echo json_encode(["success"=>false, "message"=>"No defaults found for crop/district"]);
  exit;
}

echo json_encode([
  "success" => true,
  "crop" => $cropRow,
  "district" => $distRow
], JSON_UNESCAPED_UNICODE);

$conn->close();
