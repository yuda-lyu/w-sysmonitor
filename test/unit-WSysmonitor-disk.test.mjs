import assert from 'assert'
import fs from 'fs'
import cp from 'child_process'
import { syncBuiltinESMExports } from 'module'
import wsm from '../src/WSysmonitor.mjs'


//以替換getDisksInfo於呼叫時才讀取之底層依賴, 驅動真實WSysmonitor與getDisksInfo走成功、失敗、無磁碟與逾時路徑:
//Windows替換fs.promises.statfs, 其他平台替換child_process.execFile(只攔df, 以syncBuiltinESMExports同步ESM具名匯出)
//逾時設定相關測試以覆寫process.platform強制走指定平台之路徑, 使兩平台之選項於任一宿主(含僅跑ubuntu之CI)皆受驗證


describe('WSysmonitor: 磁碟查詢之失敗、無磁碟與逾時設定', function() {

    let realStatfs = fs.promises.statfs
    let realExecFile = cp.execFile
    let platformDesc = null

    let stat = { type: 0, bsize: 4096, blocks: 1000, bfree: 600, bavail: 600 }
    let dfOut = 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 1000 400 600 40% /\n'
    let dfTimeouts = [] //非Windows時記錄傳入df之逾時

    function enoent() {
        let e = new Error('ENOENT')
        e.code = 'ENOENT'
        return e
    }

    function setPlatform(p) {
        Object.defineProperty(process, 'platform', { ...platformDesc, value: p })
    }

    function setDisk(mode) { //'ok'、'fail'、'empty'、'slow'(查詢需100ms)、'hangZ'(Windows之Z:永不回應)
        if (process.platform === 'win32') {
            if (mode === 'fail') {
                fs.promises.statfs = null //statfs不可用, getDisksInfo reject
            }
            else if (mode === 'ok') {
                fs.promises.statfs = (p) => (p === 'C:\\' ? Promise.resolve(stat) : Promise.reject(enoent()))
            }
            else if (mode === 'slow') {
                fs.promises.statfs = (p) => (p === 'C:\\' ? new Promise((resolve) => setTimeout(() => resolve(stat), 100)) : Promise.reject(enoent()))
            }
            else if (mode === 'hangZ') {
                fs.promises.statfs = (p) => (p === 'C:\\' ? Promise.resolve(stat) : p === 'Z:\\' ? new Promise(() => {}) : Promise.reject(enoent()))
            }
            else {
                fs.promises.statfs = () => Promise.reject(enoent()) //全部代號皆不存在, getDisksInfo resolve []
            }
            return
        }
        cp.execFile = (...a) => {
            if (a[0] !== 'df') {
                return realExecFile(...a) //只攔df, 其餘(如node-os-utils於macOS經cp.exec呼叫vm_stat、sysctl)交回真實execFile
            }
            let [, , opt, cb] = a
            dfTimeouts.push(opt.timeout)
            if (mode === 'slow') {
                //模擬execFile: df需100ms, 逾時短於此者於逾時時被SIGKILL中止
                if (opt.timeout < 100) {
                    setTimeout(() => cb(Object.assign(new Error('Command failed: df -kP'), { code: null, killed: true, signal: 'SIGKILL' }), '', ''), opt.timeout)
                }
                else {
                    setTimeout(() => cb(null, dfOut, ''), 100)
                }
                return
            }
            setImmediate(() => {
                if (mode === 'fail') {
                    let e = new Error('spawn df ENOENT')
                    e.code = 'ENOENT'
                    cb(e, '', '')
                    return
                }
                cb(null, dfOut, '')
            })
        }
        syncBuiltinESMExports()
    }

    async function run(mode, opt = {}) {
        setDisk(mode)
        let n = 0
        let log = console.log
        console.log = (...a) => {
            if (String(a[0]).includes('catch getDisksInfo')) {
                n++
                return
            }
            log(...a)
        }
        try {
            return { d: await wsm({ timeCpuUsage: 10, ...opt }), n }
        }
        finally {
            console.log = log
        }
    }

    beforeEach(function() {
        platformDesc = Object.getOwnPropertyDescriptor(process, 'platform')
        dfTimeouts = []
    })

    afterEach(function() {
        Object.defineProperty(process, 'platform', platformDesc)
        fs.promises.statfs = realStatfs
        cp.execFile = realExecFile
        syncBuiltinESMExports()
    })

    it('查詢失敗時WSysmonitor仍resolve, 磁碟欄位為失敗值, 其餘資訊照常', async function() {
        await run('ok') //先成功一次以重置模組層之記錄狀態
        let { d } = await run('fail')
        assert.strict.equal(d.disksInfo, '')
        for (let k of ['diskCount', 'diskTotal', 'diskFree', 'diskUsed', 'diskUsedPercentage']) {
            assert.strict.equal(d[k], 0, k)
        }
        assert.ok(d.memTotal > 0)
        assert.ok(d.cpuCount > 0)
    })

    it('同一錯誤持續發生時只記錄一次, 成功後再失敗則再記錄', async function() {
        let n = (await run('ok')).n
        assert.strict.equal(n, 0)
        for (let i = 0; i < 3; i++) {
            n += (await run('fail')).n
        }
        assert.strict.equal(n, 1)
        n += (await run('ok')).n
        n += (await run('fail')).n
        assert.strict.equal(n, 2)
    })

    it('成功時各磁碟與加總欄位依byte換算為GB', async function() {
        let { d } = await run('ok')
        assert.strict.equal(d.diskCount, 1)
        let v = d.disksInfo[0]
        if (process.platform === 'win32') {
            assert.strict.deepEqual(v, { name: 'C:', display: '', total: 1000 * 4096 / 1024 ** 3, free: 600 * 4096 / 1024 ** 3, used: 400 * 4096 / 1024 ** 3, usedPercentage: 40 })
        }
        else {
            assert.strict.deepEqual(v, { name: '/', display: '/dev/sda1', total: 1000 * 1024 / 1024 ** 3, free: 600 * 1024 / 1024 ** 3, used: 400 * 1024 / 1024 ** 3, usedPercentage: 40 })
        }
        assert.strict.equal(d.diskUsedPercentage, 40)
    })

    it('磁碟逾時設定轉交查詢: 適用之逾時短於查詢所需時該次失敗, 足夠時列出; 不適用本平台之逾時不起作用', async function() {
        //Windows適用timeoutDiskDrive(每個磁碟代號), 其他平台適用timeoutDisk(df)
        for (let [p, k, kOther] of [['win32', 'timeoutDiskDrive', 'timeoutDisk'], ['linux', 'timeoutDisk', 'timeoutDiskDrive']]) {
            setPlatform(p)
            await run('ok') //重置模組層之記錄狀態
            let r1 = await run('slow', { [k]: 30 })
            assert.strict.equal(r1.d.disksInfo, '', p)
            assert.strict.equal(r1.d.diskCount, 0, p)
            assert.strict.equal(r1.n, 1, p)
            let r2 = await run('slow', { [k]: 1000 })
            assert.strict.equal(r2.d.diskCount, 1, p)
            let r3 = await run('slow', { [k]: 'abc' }) //非數值時用預設(Windows 3000、其他10000), 皆足夠
            assert.strict.equal(r3.d.diskCount, 1, p)
            let r4 = await run('slow', { [kOther]: 30 }) //不適用本平台之逾時
            assert.strict.equal(r4.d.diskCount, 1, p)
        }
    })

    it('df逾時(timeoutDisk)原樣轉交, 未給或非正數時為10000, 超過上限時為2147483647', async function() {
        setPlatform('linux')
        await run('ok', { timeoutDisk: 4321 })
        await run('ok')
        await run('ok', { timeoutDisk: -1 })
        await run('ok', { timeoutDisk: 2 ** 31 })
        await run('ok', { timeoutDiskDrive: 4321 }) //不適用之選項不影響df
        assert.strict.deepEqual(dfTimeouts, [4321, 10000, 10000, 2147483647, 10000])
    })

    it('Windows每個磁碟代號之逾時(timeoutDiskDrive)未給時為3000', async function() {
        setPlatform('win32')
        let t0 = performance.now()
        let { d } = await run('hangZ')
        let ms = performance.now() - t0
        assert.strict.equal(d.diskCount, 1)
        assert.ok(ms >= 2900 && ms < 6000, `ms=${ms}`)
    })

    it('Windows: 全部代號皆不存在時disksInfo為空陣列, 使用率為0而非NaN', async function() {
        setPlatform('win32')
        let { d } = await run('empty')
        assert.strict.deepEqual(d.disksInfo, [])
        assert.strict.equal(d.diskCount, 0)
        assert.strict.equal(d.diskUsedPercentage, 0)
    })

})
