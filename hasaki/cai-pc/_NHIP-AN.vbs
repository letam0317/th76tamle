' _NHIP-AN.vbs - day NHIP TIM (suc khoe + suc manh) len GAS, chay an (task 'Audit nhip tim PC' moi 3').
Option Explicit
Dim sh, fso, duAn, node
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
duAn = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))  ' ...\hasaki
sh.CurrentDirectory = duAn
If fso.FileExists(duAn & "\node.exe") Then node = """" & duAn & "\node.exe""" Else node = "node"
sh.Run node & " nhip-pc.mjs", 0, False
