$action = New-ScheduledTaskAction -Execute "python.exe" -Argument "`"C:\Users\lechitam\New folder\viec-lam-ca-dem\python-cu\daily_job_sync.py`"" -WorkingDirectory "C:\Users\lechitam\New folder\viec-lam-ca-dem\python-cu"
$trigger = New-ScheduledTaskTrigger -Daily -At "09:00AM"
Register-ScheduledTask -TaskName "DailyNightJobSync" -Action $action -Trigger $trigger -Description "Tu dong cao viec lam ca dem va day len Google Sheet luc 9h sang hang ngay" -Force
