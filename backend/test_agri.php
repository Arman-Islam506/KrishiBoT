<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "TEST START<br>";

require __DIR__ . "/db.php";

if (!isset($conn) || !$conn) {
  die("DB conn missing or failed<br>");
}

echo "DB CONNECTED ✅<br>";

// show DB name
$dbRes = mysqli_query($conn, "SELECT DATABASE() AS db");
$dbRow = mysqli_fetch_assoc($dbRes);
echo "Current DB: " . htmlspecialchars($dbRow["db"] ?? "NULL") . "<br><br>";

// list tables (so we know the exact table name)
echo "Tables:<br>";
$tq = mysqli_query($conn, "SHOW TABLES");
if (!$tq) die("SHOW TABLES failed: " . mysqli_error($conn));
while ($t = mysqli_fetch_row($tq)) {
  echo "- " . htmlspecialchars($t[0]) . "<br>";
}

echo "<br>Trying query on agri_dataset...<br>";

$q = mysqli_query($conn, "SELECT * FROM agri_dataset LIMIT 5");
if (!$q) {
  die("Query failed: " . mysqli_error($conn));
}

$rows = 0;
while ($row = mysqli_fetch_assoc($q)) {
  $rows++;
  // print any two columns safely
  echo "Row $rows: " . htmlspecialchars(json_encode($row, JSON_UNESCAPED_UNICODE)) . "<br><br>";
}

echo "DONE ✅ Rows fetched: $rows<br>";
