import assert from 'assert'
import fs from 'fs'
import { spawnSync } from 'child_process'
import _ from 'lodash-es'
import wsm from '../src/WSysmonitor.mjs'


let cv = 1024 * 1024 * 1024 //byte -> g


describe('WSysmonitor', function() {

    let ks = ['cpuInfo', 'cpuCount', 'cpuUsedPercentage', 'cpuModel', 'disksInfo', 'diskCount', 'diskTotal', 'diskFree', 'diskUsed', 'diskUsedPercentage', 'memInfo', 'memFree', 'memTotal', 'memUsed', 'memUsedPercentage', 'heapInfo', 'heapTotal', 'heapFree', 'heapUsed', 'heapUsedPercentage', 'netsInfo', 'osPlatform', 'osUptime', 'osHostname', 'osType', 'osArch', 'osMachine', 'userInfo']

    it('test', async function() {
        let d = await wsm()
        let r = _.keys(d)
        let rr = ks
        assert.strict.deepEqual(r, rr)
    })

    it('disksInfo列出磁碟, 各欄位與加總欄位為有限數值', async function() {
        let d = await wsm()
        assert.ok(Array.isArray(d.disksInfo), `disksInfo=${JSON.stringify(d.disksInfo)}`)
        assert.ok(d.disksInfo.length >= 1)
        let total = 0
        let free = 0
        let used = 0
        for (let v of d.disksInfo) {
            assert.strict.deepEqual(_.keys(v), ['name', 'display', 'total', 'free', 'used', 'usedPercentage'])
            assert.strict.equal(typeof v.name, 'string')
            assert.strict.equal(typeof v.display, 'string')
            for (let k of ['total', 'free', 'used', 'usedPercentage']) {
                assert.ok(Number.isFinite(v[k]) && v[k] >= 0, `${v.name} ${k}=${v[k]}`)
            }
            assert.ok(v.total > 0)
            assert.ok(v.free <= v.total && v.used <= v.total)
            assert.ok(Math.abs(v.usedPercentage - v.used / v.total * 100) < 1e-9)
            total += v.total
            free += v.free
            used += v.used
        }
        assert.strict.equal(d.diskCount, d.disksInfo.length)
        assert.ok(Math.abs(d.diskTotal - total) < 1e-6)
        assert.ok(Math.abs(d.diskFree - free) < 1e-6)
        assert.ok(Math.abs(d.diskUsed - used) < 1e-6)
        assert.ok(Number.isFinite(d.diskUsedPercentage))
        assert.ok(Math.abs(d.diskUsedPercentage - used / total * 100) < 1e-9)
    })

    it('Windows: 不依賴wmic, 各固定磁碟皆列出且總量與Win32_LogicalDisk一致', async function() {
        if (process.platform !== 'win32') {
            this.skip()
        }

        //以PowerShell CIM為比對基準, 僅取數值與代號欄位以避開語系編碼
        let p = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,Size,FreeSpace | ConvertTo-Json -Compress'], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
        assert.strict.equal(p.error, undefined)
        assert.strict.equal(p.status, 0, p.stderr)
        let cims = _.flatten([JSON.parse(p.stdout)])
        let fixeds = cims.filter((v) => v.DriveType === 3 && v.Size !== null)
        assert.ok(fixeds.length >= 1)

        let d = await wsm()
        for (let c of fixeds) {
            let v = _.find(d.disksInfo, { name: c.DeviceID })
            assert.ok(v, `固定磁碟${c.DeviceID}未列出`)
            assert.strict.equal(v.display, '')
            assert.strict.equal(v.total * cv, Number(c.Size))
            assert.ok(Math.abs(v.free * cv - Number(c.FreeSpace)) <= cv, `${c.DeviceID} free差異過大`) //兩次查詢間磁碟可能有寫入, 容許1GB
        }
        for (let v of d.disksInfo) {
            assert.ok(_.find(cims, { DeviceID: v.name }), `${v.name}不在Win32_LogicalDisk內`)
        }
    })

    it('非Windows: 根目錄之總量與fs.statfs一致(單位換算正確)', async function() {
        if (process.platform === 'win32') {
            this.skip()
        }
        let d = await wsm()
        let v = _.find(d.disksInfo, { name: '/' })
        assert.ok(v, `未列出根目錄: ${JSON.stringify(d.disksInfo)}`)
        let s = fs.statfsSync('/')
        let total = Number(s.blocks) * Number(s.frsize || s.bsize)
        assert.ok(Math.abs(v.total * cv - total) <= total * 0.01, `df=${v.total * cv} statfs=${total}`) //容許1%, 舊版單位錯誤為512或1024倍
    })

    it('以子程序執行時不輸出wmic或磁碟錯誤訊息', async function() {
        let url = new URL('../src/WSysmonitor.mjs', import.meta.url).href //依測試檔位置定位, 不依賴執行時之工作目錄
        let code = `import wsm from ${JSON.stringify(url)}; let r = await wsm(); console.log(JSON.stringify({ diskCount: r.diskCount }))`
        let p = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
        assert.strict.equal(p.error, undefined)
        assert.strict.equal(p.status, 0, p.stderr)
        let out = `${p.stdout}\n${p.stderr}`
        assert.ok(!/wmic/i.test(out), out)
        assert.ok(!out.includes('catch getDisksInfo'), out)
        assert.ok(JSON.parse(p.stdout.trim().split('\n').pop()).diskCount >= 1, p.stdout)
    })

})
