<?php
header("Content-Type: application/json");
require "db.php";

$farmer_id = $_GET['farmer_id'] ?? '';

if (!$farmer_id) {
    echo json_encode([
        "status" => "error",
        "message" => "Missing farmer_id"
    ]);
    exit;
}

$sql = "SELECT id, sender, message_text, created_at
        FROM chat_messages
        WHERE farmer_id = ?
        ORDER BY id ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $farmer_id);
$stmt->execute();
$result = $stmt->get_result();

$messages = [];
while ($row = $result->fetch_assoc()) {
    $messages[] = $row;
}

echo json_encode([
    "status" => "success",
    "messages" => $messages
]);
