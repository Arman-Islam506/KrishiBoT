<?php
header("Content-Type: application/json; charset=UTF-8");
require "db.php";

// Recent farmer chats (latest first)
$sql = "
SELECT
  f.name AS user,
  c.message_text AS query,
  c.created_at AS date
FROM chat_messages c
JOIN farmers f ON c.farmer_id = f.id
ORDER BY c.created_at DESC
LIMIT 10
";

$result = $conn->query($sql);

if (!$result) {
    echo json_encode([
        "status" => "error",
        "message" => "SQL error: " . $conn->error
    ]);
    exit;
}

$chats = [];
while ($row = $result->fetch_assoc()) {
    $chats[] = $row;
}

echo json_encode([
    "status" => "success",
    "chats"  => $chats
]);

$conn->close();
