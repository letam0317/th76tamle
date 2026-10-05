' Chay pc-login-agent.mjs an (khong cua so) - dung cho scheduled task.
Dim sh: Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\lechitam\New folder\hasaki"
sh.Run """C:\Program Files\nodejs\node.exe"" pc-login-agent.mjs --once", 0, False
