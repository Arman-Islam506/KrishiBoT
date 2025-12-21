<?php
header("Content-Type: application/json; charset=utf-8");
require "db.php";

$phone    = $_POST['phone']    ?? '';
$password = $_POST['password'] ?? '';

if ($phone === '' || $password === '') {
    echo json_encode([
        "status"  => "error",
        "message" => "Phone and password required"
    ]);
    exit;
}

$sql  = "SELECT * FROM farmers WHERE phone = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $phone);
$stmt->execute();
$result = $stmt->get_result();

if (!$result || $result->num_rows === 0) {
    echo json_encode([
        "status"  => "error",
        "message" => "No account found with this phone number"
    ]);
    exit;
}

$user = $result->fetch_assoc();

if (!password_verify($password, $user['password_hash'])) {
    echo json_encode([
        "status"  => "error",
        "message" => "Wrong password"
    ]);
    exit;
}

echo json_encode([
    "status" => "success",
    "user"   => $user
]);

$stmt->close();
$conn->close();
?>
