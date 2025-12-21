<?php
header("Content-Type: application/json; charset=utf-8");
require "db.php";

$farmer_id = $_POST['farmer_id'] ?? '';
$sender    = $_POST['sender']    ?? '';
$message   = $_POST['message']   ?? '';

if ($farmer_id === '' || $sender === '' || $message === '') {
    echo json_encode([
        "status"  => "error",
        "message" => "Missing data"
    ]);
    exit;
}

$sql = "INSERT INTO chat_messages (farmer_id, sender, message_text)
        VALUES (?, ?, ?)";

$stmt = $conn->prepare($sql);
$stmt->bind_param("iss", $farmer_id, $sender, $message);

if ($stmt->execute()) {
    echo json_encode([
        "status" => "success",
        "id"     => $stmt->insert_id
    ]);
} else {
    echo json_encode([
        "status"  => "error",
        "message" => "DB insert failed: " . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>
