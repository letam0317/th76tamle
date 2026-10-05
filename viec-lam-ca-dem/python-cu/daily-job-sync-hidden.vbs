Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\lechitam\New folder\viec-lam-ca-dem\python-cu"
sh.Run "python.exe ""C:\Users\lechitam\New folder\viec-lam-ca-dem\python-cu\daily_job_sync.py""", 0, True
