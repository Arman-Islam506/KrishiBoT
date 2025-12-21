<?php
// backend/register.php
header('Content-Type: application/json; charset=utf-8');
include 'db.php';

$phone           = $_POST['phone']           ?? '';
$email           = $_POST['email']           ?? '';
$password        = $_POST['password']        ?? '';
$name            = $_POST['name']            ?? '';
$age             = $_POST['age']             ?? '';
$location        = $_POST['location']        ?? '';
$land_area       = $_POST['land_area']       ?? '';
$soil_type       = $_POST['soil_type']       ?? '';
$irrigation_type = $_POST['irrigation_type'] ?? '';
$lang            = $_POST['pref_lang']       ?? 'bn';

if ($phone === '' || $password === '') {
    echo json_encode([
        "status"  => "error",
        "message" => "Phone and password are required."
    ]);
    exit;
}

// hash password
$password_hash = password_hash($password, PASSWORD_BCRYPT);

// OPTIONAL: check duplicate phone
$check = $conn->prepare("SELECT id FROM farmers WHERE phone = ?");
$check->bind_param("s", $phone);
$check->execute();
$check->store_result();
if ($check->num_rows > 0) {
    echo json_encode([
        "status"  => "error",
        "message" => "This mobile number is already registered."
    ]);
    $check->close();
    exit;
}
$check->close();

$sql = "INSERT INTO farmers
        (phone, email, password_hash, full_name, age, location,
         land_area, soil_type, irrigation_type, pref_lang)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);
$stmt->bind_param(
    "ssssisssss",
    $phone,
    $email,
    $password_hash,
    $name,
    $age,
    $location,
    $land_area,
    $soil_type,
    $irrigation_type,
    $lang
);

if ($stmt->execute()) {
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode([
        "status"  => "error",
        "message" => "DB insert failed: " . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
