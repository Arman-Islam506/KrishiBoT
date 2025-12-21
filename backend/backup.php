<?php
$backupName = "krishibot_backup_" . date("Y-m-d_H-i-s") . ".sql";

header("Content-Type: application/octet-stream");
header("Content-Disposition: attachment; filename=$backupName");

$cmd = "mysqldump -u root krishibot_db";
passthru($cmd);
