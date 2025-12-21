<?php
// backend/get_crops.php
header('Content-Type: application/json; charset=utf-8');
require 'db.php';

/*
   crops table columns:
   id, crop_name, season, soil_type, temperature_range,
   rainfall_requirement, duration, note
*/

$sql = "SELECT crop_name, season, soil_type FROM crops ORDER BY crop_name ASC";
$result = $conn->query($sql);

$crops = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $crops[] = $row;
    }
}

echo json_encode([
    'status' => 'success',
    'crops'  => $crops
]);

$conn->close();
