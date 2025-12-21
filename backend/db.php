<?php
// backend/db.php  (ALWAYSDATA LIVE CONFIG)
$host   = "mysql-krishibot-admin.alwaysdata.net";
$user   = "444125";
$pass   = "Arman2120314";      // set this in alwaysdata → Databases → MySQL → Users
$dbname = "krishibot-admin_krishi_db";


$conn = mysqli_connect($host, $user, $pass, $dbname);

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

mysqli_set_charset($conn, "utf8mb4");
?>