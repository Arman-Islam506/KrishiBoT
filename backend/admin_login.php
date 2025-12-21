<?php
header("Content-Type: application/json; charset=UTF-8");
require "db.php";

$admin_id = $_POST['admin_id'] ?? '';
$password = $_POST['password'] ?? '';

if ($admin_id === '' || $password === '') {
    echo json_encode([
        "status"  => "error",
        "message" => "Admin ID and password are required."
    ]);
    exit;
}

$stmt = $conn->prepare("SELECT id, name, admin_id, password_hash FROM admins WHERE admin_id = ? LIMIT 1");
$stmt->bind_param("s", $admin_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode([
        "status"  => "error",
        "message" => "Admin not found."
    ]);
    exit;
}

$admin = $result->fetch_assoc();

if (hash("sha256", $password) !== $admin["password_hash"]) {
    echo json_encode([
        "status"  => "error",
        "message" => "Incorrect password."
    ]);
    exit;
}

echo json_encode([
    "status" => "success",
    "admin"  => [
        "id"       => $admin["id"],
        "name"     => $admin["name"],
        "admin_id" => $admin["admin_id"]
    ]
]);

$conn->close();
exit;
