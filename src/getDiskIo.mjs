import { execFile } from 'child_process'


function runPowerShell(psScript) {
    return new Promise((resolve, reject) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
            { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
            (err, stdout, stderr) => {
                // powershell 有時 stderr 會有雜訊，先保留給上層判斷
                if (err) {
                    return reject(new Error((stderr && String(stderr).trim()) || err.message))
                }
                resolve({ stdout, stderr })
            }
        )
    })
}

function bpsToMBps(bps) {
    return Math.round((Number(bps || 0) / 1024 / 1024) * 100) / 100
}

async function getDiskIo() {

    let ps = `
    $ProgressPreference = 'SilentlyContinue'
    $ErrorActionPreference = 'Stop'

    try {

      $counters = @(
        '\\PhysicalDisk(*)\\Disk Read Bytes/sec',
        '\\PhysicalDisk(*)\\Disk Write Bytes/sec',
        '\\LogicalDisk(*)\\Disk Read Bytes/sec',
        '\\LogicalDisk(*)\\Disk Write Bytes/sec'
      )

      $r = Get-Counter -Counter $counters
      $samples = $r.CounterSamples | Select-Object Path, CookedValue

      $out = @{
        physical = @{}
        logical  = @{}
      }

      foreach ($s in $samples) {

        $p = [string]$s.Path
        $v = [double]$s.CookedValue

        # PhysicalDisk
        if ($p -match 'PhysicalDisk\\((.*?)\\)\\\\Disk\\s+(Read|Write)\\s+Bytes\\/sec$') {
          $inst = $matches[1].Trim()
          $rw = $matches[2]
          if (-not $out.physical.ContainsKey($inst)) { $out.physical[$inst] = @{ readBps = 0; writeBps = 0 } }
          if ($rw -eq 'Read')  { $out.physical[$inst].readBps  = $v }
          if ($rw -eq 'Write') { $out.physical[$inst].writeBps = $v }
          continue
        }

        # LogicalDisk
        if ($p -match 'LogicalDisk\\((.*?)\\)\\\\Disk\\s+(Read|Write)\\s+Bytes\\/sec$') {
          $inst = $matches[1].Trim()
          $rw = $matches[2]
          if (-not $out.logical.ContainsKey($inst)) { $out.logical[$inst] = @{ readBps = 0; writeBps = 0 } }
          if ($rw -eq 'Read')  { $out.logical[$inst].readBps  = $v }
          if ($rw -eq 'Write') { $out.logical[$inst].writeBps = $v }
          continue
        }

      }

      $out | ConvertTo-Json -Depth 6 -Compress
      exit 0

    } catch {
      # 把錯誤也輸出成 JSON，避免 stdout 空導致 JSON.parse 爆掉
      @{ error = ($_.Exception.Message) } | ConvertTo-Json -Depth 4 -Compress
      exit 0
    }
  `

    let { stdout, stderr } = await runPowerShell(ps)

    let out = String(stdout || '').trim()

    // 如果 stderr 有東西，先保留訊息（有些環境會輸出雜訊，但通常是錯誤）
    if (String(stderr || '').trim()) {
        // 你要更嚴格可直接 throw；我這裡先不 throw，因為有時 stderr 只是警告
        // throw new Error(String(stderr).trim())
    }

    if (!out) {
        throw new Error('PowerShell returned empty stdout (no JSON).')
    }

    let data = JSON.parse(out)
    if (data && data.error) {
        throw new Error(`PowerShell error: ${data.error}`)
    }

    let physical = Object.entries(data.physical || {}).map(([disk, v]) => ({
        disk,
        readBps: v.readBps,
        writeBps: v.writeBps,
        readMBps: bpsToMBps(v.readBps),
        writeMBps: bpsToMBps(v.writeBps),
    }))

    let logical = Object.entries(data.logical || {}).map(([disk, v]) => ({
        disk,
        readBps: v.readBps,
        writeBps: v.writeBps,
        readMBps: bpsToMBps(v.readBps),
        writeMBps: bpsToMBps(v.writeBps),
    }))

    return { physical, logical }
}


export default getDiskIo
