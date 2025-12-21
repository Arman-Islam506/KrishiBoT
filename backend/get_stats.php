<?php
header("Content-Type: application/json");
require "db.php";

// TOTAL CROPS
$res1 = mysqli_query($conn, "SELECT COUNT(*) AS total FROM crops");
$crops = mysqli_fetch_assoc($res1)['total'];

// TOTAL FARMERS
$res2 = mysqli_query($conn, "SELECT COUNT(*) AS total FROM farmers");
$farmers = mysqli_fetch_assoc($res2)['total'];

// CHATS TODAY
$res3 = mysqli_query($conn, "
    SELECT COUNT(*) AS total 
    FROM chat_messages 
    WHERE DATE(created_at) = CURDATE()
");
$chats_today = mysqli_fetch_assoc($res3)['total'];

// AVG BOT RESPONSE TIME (optional demo)
$avg_response = 1.2; // keep static for now

echo json_encode([
    "status" => "success",
    "stats" => [
        "crops"       => $crops,
        "farmers"     => $farmers,
        "todayChats"  => $chats_today,
        "avgResponse" => $avg_response
    ]
]);
