import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Types a reply into the terminal of a running Claude Code session, as if the person typed it: attach to the
// session's console and push key events into its input buffer, then Enter. Windows only (Win32 console API).

const MAX_REPLY = 8000

const SCRIPT = String.raw`param([int]$TargetPid, [string]$TextB64, [string]$ResultFile)
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TextB64))
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
public static class ConsoleType {
  [StructLayout(LayoutKind.Explicit, CharSet = CharSet.Unicode)]
  public struct INPUT_RECORD { [FieldOffset(0)] public ushort EventType; [FieldOffset(4)] public KEY_EVENT_RECORD KeyEvent; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct KEY_EVENT_RECORD { public int bKeyDown; public ushort wRepeatCount; public ushort wVirtualKeyCode; public ushort wVirtualScanCode; public char UnicodeChar; public uint dwControlKeyState; }
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool WriteConsoleInput(IntPtr h, INPUT_RECORD[] recs, uint len, out uint written);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static INPUT_RECORD Key(char c, ushort vk, bool down) {
    var r = new INPUT_RECORD(); r.EventType = 1;
    r.KeyEvent.bKeyDown = down ? 1 : 0; r.KeyEvent.wRepeatCount = 1; r.KeyEvent.wVirtualKeyCode = vk; r.KeyEvent.UnicodeChar = c;
    return r;
  }
  static bool Write(IntPtr h, List<INPUT_RECORD> recs) { uint n; return WriteConsoleInput(h, recs.ToArray(), (uint)recs.Count, out n); }
  public static string Send(uint pid, string text) {
    FreeConsole();
    if (!AttachConsole(pid)) return "Could not attach to the terminal (error " + Marshal.GetLastWin32Error() + ")";
    IntPtr h = CreateFile("CONIN$", 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
    if (h == new IntPtr(-1)) { int e = Marshal.GetLastWin32Error(); FreeConsole(); return "Could not open the terminal input (error " + e + ")"; }
    var keys = new List<INPUT_RECORD>();
    foreach (char c in text) { keys.Add(Key(c, 0, true)); keys.Add(Key(c, 0, false)); }
    bool ok = Write(h, keys);
    Thread.Sleep(400); // fast input reads as a paste; a separate Enter submits it instead of joining it
    ok = ok && Write(h, new List<INPUT_RECORD> { Key('\r', 0x0D, true), Key('\r', 0x0D, false) });
    int err = Marshal.GetLastWin32Error();
    CloseHandle(h); FreeConsole();
    return ok ? "ok" : "Could not type into the terminal (error " + err + ")";
  }
}
"@
Set-Content -Path $ResultFile -Value ([ConsoleType]::Send($TargetPid, $text)) -Encoding UTF8
`

/** One line of text, since Enter in the terminal sends the message. */
export function prepareReply(text: string): string {
  return text
    .replace(/\s*\r?\n\s*/g, ' ')
    .trim()
    .slice(0, MAX_REPLY)
}

export function typeIntoSession(pid: number, text: string): Promise<void> {
  const reply = prepareReply(text)
  if (!reply) return Promise.reject(new Error('Nothing to send'))
  if (process.platform !== 'win32') return Promise.reject(new Error('Replying to a terminal works on Windows only'))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chugnus-reply-'))
  const scriptPath = path.join(dir, 'type.ps1')
  const resultPath = path.join(dir, 'result.txt')
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8')
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
  args.push(
    '-TargetPid',
    String(pid),
    '-TextB64',
    Buffer.from(reply, 'utf8').toString('base64'),
    '-ResultFile',
    resultPath
  )
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', args, { windowsHide: true, timeout: 30000 }, (err, _stdout, stderr) => {
      let result = ''
      try {
        // trim() also drops the BOM that Set-Content writes
        result = fs.readFileSync(resultPath, 'utf8').trim()
      } catch {
        /* the script failed before writing a result */
      }
      fs.rmSync(dir, { recursive: true, force: true })
      if (result === 'ok') resolve()
      else reject(new Error(result || stderr.trim().split('\n')[0] || err?.message || 'Could not reach the terminal'))
    })
  })
}
