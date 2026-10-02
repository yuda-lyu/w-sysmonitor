import assert from 'assert'
import getDisksInfo from '../src/getDisksInfo.mjs'


//測試資料來源:
//  [實跑GNU]     Git for Windows內附GNU coreutils 8.32之df, 2026-10-02於本機實跑
//  [實跑BusyBox] Docker Desktop之docker-desktop WSL distro(BusyBox v1.37.0、musl 1.2.5), 2026-10-02於本機實跑
//  [macOS 15]    https://github.com/HorlogeSkynet/archey4/issues/170 留言中之df -P -k原文
//  [FreeBSD 14.3] https://github.com/webmin/webmin/issues/2653 留言中之df -k原文
//  [合成]        依POSIX與FreeBSD df之輸出格式合成, 數值為虛構
//  [實測statfs]  Node.js v24.19.0於Windows 11實測fs.promises.statfs之回傳與錯誤碼


let kb = (n) => n * 1024

let LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')


function lines(...ls) {
    return ls.join('\n') + '\n'
}


function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}


function countTimers() {
    return process.getActiveResourcesInfo().filter((v) => v === 'Timeout').length
}


async function withDateNow(fn, run) {
    let bk = Date.now
    Date.now = fn
    try {
        return await run()
    }
    finally {
        Date.now = bk
    }
}


function createExecFile(res) {
    let calls = []
    let fn = (cmd, args, options, cb) => {
        calls.push({ cmd, args, options })
        if (res === 'hang') {
            return //模擬df卡住不結束
        }
        setTimeout(() => {
            cb(res.err || null, res.stdout || '', res.stderr || '')
        }, res.delay || 0)
    }
    fn.calls = calls
    return fn
}


function createErr(code, errno, p) {
    let err = new Error(`${code}: statfs '${p}'`)
    err.code = code
    err.errno = errno
    err.syscall = 'statfs'
    err.path = p
    return err
}


function createStatfs(table) {
    let calls = []
    let fn = (p) => {
        calls.push(p)
        let v = table[p]
        if (typeof v === 'function') {
            return v(p)
        }
        if (v === 'hang') {
            return new Promise(() => {}) //模擬斷線之網路磁碟不回應
        }
        if (v === 'throw') {
            throw new Error('sync throw')
        }
        if (v === 'UNKNOWN') {
            return Promise.reject(createErr('UNKNOWN', -4094, p)) //[實測statfs]無媒體之光碟機
        }
        if (v) {
            return Promise.resolve(v)
        }
        return Promise.reject(createErr('ENOENT', -4058, p)) //[實測statfs]不存在之磁碟代號
    }
    fn.calls = calls
    return fn
}


//[實測statfs] C:之回傳值
let statC = { type: 0, bsize: 4096, frsize: 4096, blocks: 50033407, bfree: 8518440, bavail: 8518440, files: 0, ffree: 0 }


describe('getDisksInfo', function() {

    describe('非Windows: 解析df -kP', function() {

        it('[實跑GNU] 裝置名含空白, 數值依1024-blocks換算為byte', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                    'C:/Program Files/Git   200133628 166051432  34082196      83% /',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r, [
                { name: '/', display: 'C:/Program Files/Git', total: kb(200133628), free: kb(34082196), used: kb(166051432) },
            ])
        })

        it('[實跑GNU] 設POSIXLY_CORRECT之512-blocks依標頭單位換算', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           512-blocks      Used Available Capacity Mounted on',
                    'C:/Program Files/Git  400267256 332102872  68164384      83% /',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r, [
                { name: '/', display: 'C:/Program Files/Git', total: 400267256 * 512, free: 68164384 * 512, used: 332102872 * 512 },
            ])
            assert.strict.equal(r[0].total, kb(200133628)) //與同一磁碟之1024-blocks結果一致
        })

        it('[實跑GNU] df -a之數值未知佔位列(-)略過', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem                       1024-blocks      Used Available Capacity Mounted on',
                    'C:/Program Files/Git               200133628 166051972  34081656      83% /',
                    'C:/Program Files/Git/usr/bin               -         -         -        - /bin',
                    'C:/Users/semi/AppData/Local/Temp           -         -         -        - /tmp',
                    'C:                                         -         -         -        - /c',
                    'D:                                         -         -         -        - /d',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r.map((v) => v.name), ['/'])
        })

        it('[實跑BusyBox] 各列皆解析, 同一裝置多處掛載照列, 裝置名含反斜線', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           1024-blocks    Used Available Capacity Mounted on',
                    'none                   5091132         0   5091132   0% /lib/modules/6.18.33.2-microsoft-standard-WSL2',
                    'none                   5091132         4   5091128   0% /mnt/host/wsl',
                    'drivers              200133628 166070568  34063060  83% /usr/lib/wsl/drivers',
                    '/dev/sdd                129661     64388     55165  54% /',
                    'none                   5091132        12   5091120   0% /mnt/host/wslg',
                    '/dev/sdd                129661     64388     55165  54% /mnt/host/wslg/distro',
                    'none                   5091132         0   5091132   0% /usr/lib/wsl/lib',
                    'none                   5085376         0   5085376   0% /dev',
                    'none                   5091132         0   5091132   0% /run',
                    'none                   5091132         0   5091132   0% /run/lock',
                    'none                   5091132         0   5091132   0% /run/shm',
                    'none                   5091132         0   5091132   0% /dev/shm',
                    'none                   5091132         0   5091132   0% /run/user',
                    'none                   5091132        60   5091072   0% /mnt/host/wslg/versions.txt',
                    'none                   5091132        60   5091072   0% /mnt/host/wslg/doc',
                    'none                   5091132        12   5091120   0% /tmp/.X11-unix',
                    'C:\\                  200133628 166070572  34063056  83% /mnt/host/c',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.equal(r.length, 17)
            assert.strict.deepEqual(r.find((v) => v.name === '/'), { name: '/', display: '/dev/sdd', total: kb(129661), free: kb(55165), used: kb(64388) })
            assert.strict.deepEqual(r.find((v) => v.name === '/mnt/host/c'), { name: '/mnt/host/c', display: 'C:\\', total: kb(200133628), free: kb(34063056), used: kb(166070572) })
        })

        it('[實跑BusyBox] 設POSIXLY_CORRECT時標頭為512-blocks, 依標頭換算', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           512-blocks     Used Available Capacity Mounted on',
                    '/dev/sdd                259322    128776    110330  54% /',
                    'C:\\                  400267256 332141768  68125488  83% /mnt/host/c',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.equal(r[0].total, 259322 * 512)
            assert.strict.equal(r[0].total, kb(129661)) //與同一磁碟之1024-blocks結果一致
        })

        it('[實跑BusyBox] 裝置名與掛載點含空白、長裝置名', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           1024-blocks    Used Available Capacity Mounted on',
                    'my dev                    1024         0      1024   0% /tmp/wf df sp',
                    'a_very_long_device_name_over_20_chars                       2048         0      2048   0% /tmp/wf_long',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r, [
                { name: '/tmp/wf df sp', display: 'my dev', total: kb(1024), free: kb(1024), used: 0 },
                { name: '/tmp/wf_long', display: 'a_very_long_device_name_over_20_chars', total: kb(2048), free: kb(2048), used: 0 },
            ])
        })

        it('[macOS 15] 容量為0之map auto_home略過, 其餘照列', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem     1024-blocks      Used Available Capacity  Mounted on',
                    '/dev/disk1s2s1   976797816  12257768 242017456     5%    /',
                    'devfs                  199       199         0   100%    /dev',
                    '/dev/disk1s3     976797816   3299756 242017456     2%    /System/Volumes/Preboot',
                    '/dev/disk1s5     976797816        24 242017456     1%    /System/Volumes/VM',
                    '/dev/disk1s6     976797816      2248 242017456     1%    /System/Volumes/Update',
                    '/dev/disk1s1     976797816 717599228 242017456    75%    /System/Volumes/Data',
                    'map auto_home            0         0         0   100%    /System/Volumes/Data/home',
                ),
            })
            let r = await getDisksInfo({ platform: 'darwin', execFile })
            assert.strict.deepEqual(r.map((v) => v.name), [
                '/',
                '/dev',
                '/System/Volumes/Preboot',
                '/System/Volumes/VM',
                '/System/Volumes/Update',
                '/System/Volumes/Data',
            ])
            assert.strict.deepEqual(r[0], { name: '/', display: '/dev/disk1s2s1', total: kb(976797816), free: kb(242017456), used: kb(12257768) })
        })

        it('[macOS 15] 網路磁碟、掛載點含空白、引號、不換行空白與韓文', async function() {
            let snapshot = '/Volumes/com.apple.TimeMachine.localsnapshots/Backups.backupdb/\uae40\ub300\uc11d\uc758 MacBook\u00a0Pro 16"/2026-05-03-185423/Macintosh HD - \ub370\uc774\ud130'
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem                                                 1024-blocks       Used  Available Capacity  Mounted on',
                    '//kndol@mahanaim/G                                          3907016000 2717261372 1189754628    70%    /Volumes/mahanaim',
                    '/dev/disk3s1                                                     66520      51364      14380    79%    /Volumes/Mercury 3.4.8',
                    '/dev/disk6s2                                                2929930672 2757675568  172255104    95%    /Volumes/Time Machine',
                    `com.apple.TimeMachine.2026-05-03-185423.local@/dev/disk1s1   976797816  717334928  242106060    75%    ${snapshot}`,
                ),
            })
            let r = await getDisksInfo({ platform: 'darwin', execFile })
            assert.strict.deepEqual(r, [
                { name: '/Volumes/mahanaim', display: '//kndol@mahanaim/G', total: kb(3907016000), free: kb(1189754628), used: kb(2717261372) },
                { name: '/Volumes/Mercury 3.4.8', display: '/dev/disk3s1', total: kb(66520), free: kb(14380), used: kb(51364) },
                { name: '/Volumes/Time Machine', display: '/dev/disk6s2', total: kb(2929930672), free: kb(172255104), used: kb(2757675568) },
                { name: snapshot, display: 'com.apple.TimeMachine.2026-05-03-185423.local@/dev/disk1s1', total: kb(976797816), free: kb(242106060), used: kb(717334928) },
            ])
        })

        it('[FreeBSD 14.3] 標頭為Avail亦可解析', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem 1024-blocks Used     Avail Capacity  Mounted on',
                    'zroot/tmp    380491564  316 380491248     0%    /tmp',
                ),
            })
            let r = await getDisksInfo({ platform: 'freebsd', execFile })
            assert.strict.deepEqual(r, [
                { name: '/tmp', display: 'zroot/tmp', total: kb(380491564), free: kb(380491248), used: kb(316) },
            ])
        })

        it('[合成] 可用量為負(用量超過保留區)時保留該列且free為0', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem         1024-blocks     Used     Avail Capacity  Mounted on',
                    '/dev/ada1p1            1000000   980000    -60000   107%    /data',
                    '/dev/da0s1            30000000  1000000  29000000     3%    /mnt/backup disk',
                ),
            })
            let r = await getDisksInfo({ platform: 'freebsd', execFile })
            assert.strict.deepEqual(r, [
                { name: '/data', display: '/dev/ada1p1', total: kb(1000000), free: 0, used: kb(980000) },
                { name: '/mnt/backup disk', display: '/dev/da0s1', total: kb(30000000), free: kb(29000000), used: kb(1000000) },
            ])
        })

        it('[實跑GNU] 部分掛載點無法讀取致離開碼為1但有資料列時照常解析', async function() {
            let err = new Error('Command failed: df -kP\ndf: /nonexistent_wfcritic: No such file or directory')
            err.code = 1
            let execFile = createExecFile({
                err,
                stdout: lines(
                    'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                    'C:/Program Files/Git   200133628 166193344  33940284      84% /',
                ),
                stderr: 'df: /nonexistent_wfcritic: No such file or directory\n',
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r.map((v) => v.name), ['/'])
        })

        it('離開碼非0且只有標頭時reject並回傳原錯誤', async function() {
            let err = new Error('Command failed: df -kP\ndf: /x: Permission denied')
            err.code = 1
            let execFile = createExecFile({
                err,
                stdout: lines('Filesystem           1024-blocks    Used Available Capacity Mounted on'),
            })
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile }), (e) => e === err)
        })

        it('離開碼為0但無資料列時reject, 不以空陣列冒充無磁碟', async function() {
            let execFile = createExecFile({
                stdout: lines('Filesystem           1024-blocks    Used Available Capacity Mounted on'),
                stderr: 'df: something\n',
            })
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile }), /df returned no disk rows: df: something/)
        })

        it('找不到df時reject', async function() {
            let err = new Error('spawn df ENOENT')
            err.code = 'ENOENT'
            let execFile = createExecFile({ err })
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile }), (e) => e === err)
        })

        it('df逾時未結束時reject, 且未結束前後續呼叫立即失敗不再啟動df', async function() {
            let execFile = createExecFile('hang')
            let t0 = Date.now()
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 60 }), /df timeout/)
            let ms = Date.now() - t0
            assert.ok(ms >= 50 && ms < 2000, `ms=${ms}`)
            let t1 = Date.now()
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 60 }), /df timeout/)
            assert.ok(Date.now() - t1 < 50)
            assert.strict.equal(execFile.calls.length, 1)
        })

        it('同時多次呼叫只啟動一次df並共用結果', async function() {
            let execFile = createExecFile({
                delay: 20,
                stdout: lines(
                    'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                    'C:/Program Files/Git   200133628 166051432  34082196      83% /',
                ),
            })
            let rs = await Promise.all([
                getDisksInfo({ platform: 'linux', execFile }),
                getDisksInfo({ platform: 'linux', execFile }),
            ])
            assert.strict.equal(execFile.calls.length, 1)
            assert.strict.deepEqual(rs[0], rs[1])
        })

        it('不同逾時之同時呼叫各自啟動df, 較長逾時者不被較短逾時者之期限一併中止', async function() {
            let stdout = lines(
                'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                'C:/Program Files/Git   200133628 166051432  34082196      83% /',
            )
            let timeouts = []
            let execFile = (cmd, args, options, cb) => {
                //模擬execFile: df需100ms, 逾時短於此者於逾時時被SIGKILL中止
                timeouts.push(options.timeout)
                if (options.timeout < 100) {
                    setTimeout(() => {
                        cb(Object.assign(new Error('Command failed: df -kP'), { code: null, killed: true, signal: 'SIGKILL' }), '', '')
                    }, options.timeout)
                    return
                }
                setTimeout(() => {
                    cb(null, stdout, '')
                }, 100)
            }
            let [ra, rb, rc] = await Promise.allSettled([
                getDisksInfo({ platform: 'linux', execFile, timeout: 50 }),
                getDisksInfo({ platform: 'linux', execFile, timeout: 1000 }),
                getDisksInfo({ platform: 'linux', execFile, timeout: 1000 }),
            ])
            assert.strict.equal(ra.status, 'rejected')
            assert.strict.equal(rb.status, 'fulfilled')
            assert.strict.deepEqual(rb.value.map((v) => v.name), ['/'])
            assert.strict.deepEqual(rc.value, rb.value)
            assert.strict.deepEqual(timeouts, [50, 1000]) //相同逾時者仍共用同一df
        })

        it('卡住之df逾期超過1秒仍未結束時, 不同逾時之後續呼叫亦立即失敗不再啟動df', async function() {
            let execFile = createExecFile('hang') //模擬SIGKILL後仍不結束之df(如FUSE請求不可中斷之等待)
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 30 }), /df timeout/)
            await delay(1050)
            let t1 = performance.now()
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 40 }), /df timeout/)
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 41 }), /df timeout/)
            assert.ok(performance.now() - t1 < 20)
            assert.strict.deepEqual(execFile.calls.map((c) => c.options.timeout), [30])
        })

        it('健康之df被逾時中止後至結束前, 緊接之不同逾時呼叫另啟df並成功, 不誤判為卡住', async function() {
            let stdout = lines(
                'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                'C:/Program Files/Git   200133628 166051432  34082196      83% /',
            )
            let timeouts = []
            let execFile = (cmd, args, options, cb) => {
                //模擬execFile: df需100ms, 逾時短於此者被SIGKILL中止, 子程序30ms後才結束並回呼
                timeouts.push(options.timeout)
                if (options.timeout < 100) {
                    setTimeout(() => {
                        cb(Object.assign(new Error('Command failed: df -kP'), { code: null, killed: true, signal: 'SIGKILL' }), '', '')
                    }, options.timeout + 30)
                    return
                }
                setTimeout(() => {
                    cb(null, stdout, '')
                }, 100)
            }
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 50 }), /df timeout/)
            let r = await getDisksInfo({ platform: 'linux', execFile, timeout: 1000 })
            assert.strict.deepEqual(r.map((v) => v.name), ['/'])
            assert.strict.deepEqual(timeouts, [50, 1000])
        })

        it('子程序參數: df -kP、移除POSIXLY_CORRECT、逾時以SIGKILL中止、timeout為整數', async function() {
            let bk = process.env.POSIXLY_CORRECT
            process.env.POSIXLY_CORRECT = '1'
            try {
                let execFile = createExecFile({
                    stdout: lines(
                        'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                        'C:/Program Files/Git   200133628 166051432  34082196      83% /',
                    ),
                })
                await getDisksInfo({ platform: 'linux', execFile, timeout: 1234.5 })
                let c = execFile.calls[0]
                assert.strict.equal(c.cmd, 'df')
                assert.strict.deepEqual(c.args, ['-kP'])
                assert.strict.equal('POSIXLY_CORRECT' in c.options.env, false)
                assert.strict.equal(process.env.POSIXLY_CORRECT, '1') //僅子程序之環境移除, 不動宿主程序環境
                assert.strict.equal(c.options.killSignal, 'SIGKILL')
                assert.strict.equal(c.options.timeout, 1235)
            }
            finally {
                if (bk === undefined) {
                    delete process.env.POSIXLY_CORRECT
                }
                else {
                    process.env.POSIXLY_CORRECT = bk
                }
            }
        })

        it('[合成] 已用或可用為-(數值未知)而總量為數字之列略過', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem     1024-blocks    Used Available Capacity Mounted on',
                    '/dev/sda1             1000     400       600      40% /',
                    'fs1                   1000       -       600        - /mnt/a',
                    'fs2                   1000     400         -        - /mnt/b',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r.map((v) => v.name), ['/'])
        })

        it('[合成依GNU df] 已用量為負(可用區塊多於總量)時保留該列且used為0', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem     1024-blocks    Used Available Capacity Mounted on',
                    'bogusfs                100      -5       105        - /mnt/bogus',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r, [
                { name: '/mnt/bogus', display: 'bogusfs', total: kb(100), free: kb(105), used: 0 },
            ])
        })

        it('[合成依FreeBSD df] 標頭為1K-blocks時以1024為單位', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem  1K-blocks Used     Avail Capacity  Mounted on',
                    'zroot/tmp   380491564  316 380491248     0%    /tmp',
                ),
            })
            let r = await getDisksInfo({ platform: 'freebsd', execFile })
            assert.strict.equal(r[0].total, kb(380491564))
        })

        it('[合成依illumos df] 已用欄為-1且使用率100%表示數值未知, 略過該列', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           1024-blocks        Used   Available Capacity  Mounted on',
                    '/dev/dsk/c0t0d0s0        1048576      524288      524288    51%    /',
                    'nfs4srv:/export          1048576          -1      524288   100%    /net/nfs4srv/export',
                    'nfs3srv:/export          1048576          -1           0   100%    /net/nfs3srv/export',
                ),
            })
            let r = await getDisksInfo({ platform: 'sunos', execFile })
            assert.strict.deepEqual(r.map((v) => v.name), ['/'])
        })

        it('[合成依GNU df] 以空字串為來源之掛載(首欄為空白)照列, display為空字串', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem     1024-blocks    Used Available Capacity Mounted on',
                    '/dev/sda1         61255492 9046436  52192672      15% /',
                    '                   4012124       8   4012116       1% /tmp/bb',
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r, [
                { name: '/', display: '/dev/sda1', total: kb(61255492), free: kb(52192672), used: kb(9046436) },
                { name: '/tmp/bb', display: '', total: kb(4012124), free: kb(4012116), used: kb(8) },
            ])
        })

        it('[合成] 掛載點與裝置名含U+2028、U+2029或CR時照列且原樣保留', async function() {
            let LS = String.fromCharCode(0x2028)
            let PS = String.fromCharCode(0x2029)
            let CR = String.fromCharCode(13)
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem     1024-blocks    Used Available Capacity Mounted on',
                    '/dev/sda1             1000     400       600      40% /',
                    `/dev/sdb1             2000    1000      1000      50% /media/u/My${LS}Disk`,
                    `dev${PS}x                3000    1000      2000      34% /mnt/p`,
                    `/dev/sdc1             4000    1000      3000      25% /mnt/a${CR}b`,
                ),
            })
            let r = await getDisksInfo({ platform: 'linux', execFile })
            assert.strict.deepEqual(r.map((v) => v.name), ['/', `/media/u/My${LS}Disk`, '/mnt/p', `/mnt/a${CR}b`])
            assert.strict.equal(r[2].display, `dev${PS}x`)
        })

        it('df被訊號終止、逾時被殺或輸出超過maxBuffer時, 即使有部分資料列亦reject', async function() {
            let stdout = lines(
                'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                'C:/Program Files/Git   200133628 166051432  34082196      83% /',
                '/dev/sdb1                  1000       400       600      40% /mnt/da',
            )
            let errs = [
                Object.assign(new Error('Command failed: df -kP'), { code: null, killed: true, signal: 'SIGKILL' }),
                Object.assign(new Error('stdout maxBuffer length exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }),
                Object.assign(new Error('Command failed: df -kP'), { code: null, killed: false, signal: 'SIGSEGV' }),
            ]
            for (let err of errs) {
                let execFile = createExecFile({ err, stdout })
                await assert.rejects(getDisksInfo({ platform: 'linux', execFile }), (e) => e === err)
            }
        })

        it('未給timeout或給非正數、非數值時df逾時為10000, 超過上限時以2147483647計', async function() {
            let stdout = lines(
                'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                'C:/Program Files/Git   200133628 166051432  34082196      83% /',
            )
            for (let timeout of [undefined, 0, -5, 'abc', NaN, Infinity]) {
                let execFile = createExecFile({ stdout })
                await getDisksInfo({ platform: 'linux', execFile, timeout })
                assert.strict.equal(execFile.calls[0].options.timeout, 10000, `timeout=${timeout}`)
            }
            for (let timeout of [2 ** 31, Number.MAX_SAFE_INTEGER]) {
                let execFile = createExecFile({ stdout })
                let r = await getDisksInfo({ platform: 'linux', execFile, timeout })
                assert.strict.equal(execFile.calls[0].options.timeout, 2147483647, `timeout=${timeout}`)
                assert.strict.deepEqual(r.map((v) => v.name), ['/'])
            }
        })

        it('df逾時未結束時, 系統時間往回調整不致使後續呼叫等待', async function() {
            let execFile = createExecFile('hang')
            await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 60 }), /df timeout/)
            let real = Date.now
            await withDateNow(() => real() - 3600 * 1000, async () => {
                let t1 = performance.now()
                await assert.rejects(getDisksInfo({ platform: 'linux', execFile, timeout: 60 }), /df timeout/)
                assert.ok(performance.now() - t1 < 50)
            })
            assert.strict.equal(execFile.calls.length, 1)
        })

        it('呼叫結束後不殘留計時器', async function() {
            let execFile = createExecFile({
                stdout: lines(
                    'Filesystem           1024-blocks      Used Available Capacity Mounted on',
                    'C:/Program Files/Git   200133628 166051432  34082196      83% /',
                ),
            })
            await Promise.resolve() //mocha之測試逾時計時器於首次await後才建立, 先讓出一輪使其納入基準
            let n0 = countTimers()
            await getDisksInfo({ platform: 'linux', execFile })
            await getDisksInfo({ platform: 'linux', execFile: createExecFile('hang'), timeout: 30 }).catch(() => {})
            assert.ok(countTimers() <= n0, `timers ${n0} -> ${countTimers()}`)
        })

    })

    describe('Windows: fs.statfs查詢A:至Z:', function() {

        it('[實測statfs] C:可查, 無媒體光碟(UNKNOWN)與不存在代號(ENOENT)略過, display為空字串', async function() {
            let statfs = createStatfs({ 'C:\\': statC, 'D:\\': 'UNKNOWN' })
            let r = await getDisksInfo({ platform: 'win32', statfs })
            let total = 50033407 * 4096
            let free = 8518440 * 4096
            assert.strict.deepEqual(r, [
                { name: 'C:', display: '', total, free, used: total - free },
            ])
            assert.strict.equal(total, 204936835072) //錨定: 依公式推導之期望總量須等於同時刻實測之Win32_LogicalDisk.Size
        })

        it('依序查詢A:\\至Z:\\(帶根目錄斜線), 且不呼叫外部程式', async function() {
            let statfs = createStatfs({ 'C:\\': statC })
            let execFile = () => {
                throw new Error('execFile should not be called on win32')
            }
            await getDisksInfo({ platform: 'win32', statfs, execFile })
            assert.strict.deepEqual(statfs.calls, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `${c}:\\`))
        })

        it('有配額時used以total-free計算且不為負', async function() {
            //配額下blocks與bavail為呼叫者範圍, bfree為整卷, 可大於blocks
            let statfs = createStatfs({ 'E:\\': { type: 0, bsize: 4096, blocks: 1000, bfree: 1200, bavail: 100 } })
            let r = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.deepEqual(r, [
                { name: 'E:', display: '', total: 1000 * 4096, free: 100 * 4096, used: 900 * 4096 },
            ])
        })

        it('bigint數值可換算', async function() {
            let statfs = createStatfs({ 'C:\\': { type: 0n, bsize: 4096n, blocks: 50033407n, bfree: 8518440n, bavail: 8518440n } })
            let r = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.equal(r[0].total, 204936835072)
            assert.strict.equal(r[0].free, 8518440 * 4096)
        })

        it('容量為0之代號與同步拋錯之代號略過', async function() {
            let statfs = createStatfs({ 'C:\\': statC, 'E:\\': { type: 0, bsize: 4096, blocks: 0, bfree: 0, bavail: 0 }, 'F:\\': 'throw' })
            let r = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.deepEqual(r.map((v) => v.name), ['C:'])
        })

        it('單碟卡住時逾時略過該碟, 其未結束前後續呼叫不重發且立即略過', async function() {
            let statfs = createStatfs({ 'C:\\': statC, 'Z:\\': 'hang' })
            let t0 = Date.now()
            let r1 = await getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 60 })
            let ms1 = Date.now() - t0
            assert.strict.deepEqual(r1.map((v) => v.name), ['C:'])
            assert.ok(ms1 >= 50 && ms1 < 2000, `ms1=${ms1}`)
            let t1 = Date.now()
            let r2 = await getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 60 })
            assert.strict.deepEqual(r2.map((v) => v.name), ['C:'])
            assert.ok(Date.now() - t1 < 50)
            assert.strict.equal(statfs.calls.filter((p) => p === 'Z:\\').length, 1)
        })

        it('不同逾時之同時呼叫共用同一statfs, 各依自身逾時: 較短者逾時略過, 較長者取得該碟', async function() {
            //短逾時者先發起
            let statfs = createStatfs({ 'C:\\': () => delay(100).then(() => statC) })
            let [ra, rb] = await Promise.allSettled([
                getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 30 }),
                getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 1000 }),
            ])
            assert.strict.equal(ra.status, 'rejected')
            assert.strict.equal(ra.reason.message, 'statfs timeout: C:')
            assert.strict.deepEqual(rb.value.map((v) => v.name), ['C:'])
            assert.strict.equal(statfs.calls.filter((p) => p === 'C:\\').length, 1) //共用同一請求
            //長逾時者先發起, 短逾時者後加入仍依自身逾時失敗, 不被延長
            let statfs2 = createStatfs({ 'C:\\': () => delay(100).then(() => statC) })
            let pmLong = getDisksInfo({ platform: 'win32', statfs: statfs2, timeoutDrive: 1000 })
            let t1 = performance.now()
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs: statfs2, timeoutDrive: 30 }), (e) => e.message === 'statfs timeout: C:')
            assert.ok(performance.now() - t1 < 90)
            assert.strict.deepEqual((await pmLong).map((v) => v.name), ['C:'])
            assert.strict.equal(statfs2.calls.filter((p) => p === 'C:\\').length, 1)
        })

        it('全部代號皆逾時時reject, 不以空陣列冒充無磁碟, 訊息依代號順序', async function() {
            let table = {}
            LETTERS.forEach((c) => {
                table[`${c}:\\`] = 'hang'
            })
            let statfs = createStatfs(table)
            let msg = `statfs timeout: ${LETTERS.map((c) => `${c}:`).join(', ')}`
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 30 }), (e) => e.message === msg)
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 30 }), (e) => e.message === msg) //後續呼叫訊息相同, 使記錄去重生效
        })

        it('唯一可查之代號卡住而其餘代號不存在時reject, 訊息只含該代號', async function() {
            let statfs = createStatfs({ 'C:\\': 'hang' })
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 30 }), (e) => e.message === 'statfs timeout: C:')
        })

        it('全部代號皆以不存在以外之錯誤失敗(如Node權限模型拒絕)時reject並列出代號與錯誤碼', async function() {
            let table = {}
            LETTERS.forEach((c) => {
                table[`${c}:\\`] = (p) => Promise.reject(createErr('ERR_ACCESS_DENIED', undefined, p))
            })
            let statfs = createStatfs(table)
            let msg = `statfs failed: ${LETTERS.map((c) => `${c}: ERR_ACCESS_DENIED`).join(', ')}`
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs }), (e) => e.message === msg)
        })

        it('無可查之代號且僅無媒體光碟(UNKNOWN)時reject', async function() {
            let statfs = createStatfs({ 'D:\\': 'UNKNOWN' })
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs }), (e) => e.message === 'statfs failed: D: UNKNOWN')
        })

        it('有可查之代號時, 其餘代號無權限仍回傳可查者', async function() {
            let table = {}
            LETTERS.forEach((c) => {
                table[`${c}:\\`] = (p) => Promise.reject(createErr('EPERM', -4048, p))
            })
            table['C:\\'] = statC
            let statfs = createStatfs(table)
            let r = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.deepEqual(r.map((v) => v.name), ['C:'])
        })

        it('錯誤訊息依代號順序, 不受各代號完成先後影響', async function() {
            let make = (reverse) => {
                let table = {}
                LETTERS.forEach((c, k) => {
                    let ms = reverse ? (LETTERS.length - k) : k
                    table[`${c}:\\`] = (p) => delay(ms).then(() => Promise.reject(createErr('EPERM', -4048, p)))
                })
                return createStatfs(table)
            }
            let e1 = await getDisksInfo({ platform: 'win32', statfs: make(true) }).catch((e) => e)
            let e2 = await getDisksInfo({ platform: 'win32', statfs: make(false) }).catch((e) => e)
            assert.ok(e1.message.startsWith('statfs failed: A: EPERM, B: EPERM, C: EPERM'), e1.message)
            assert.strict.equal(e1.message, e2.message)
        })

        it('先前失敗之代號於後續呼叫重新查詢, 之後可查得者即列出', async function() {
            let table = { 'C:\\': statC }
            let statfs = createStatfs(table)
            let r1 = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.deepEqual(r1.map((v) => v.name), ['C:'])
            table['E:\\'] = statC //如插入隨身碟或光碟
            let r2 = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.deepEqual(r2.map((v) => v.name), ['C:', 'E:'])
            assert.strict.equal(statfs.calls.filter((p) => p === 'E:\\').length, 2)
        })

        it('明確給statfs為undefined時同未給, 使用預設fs.promises.statfs', async function() {
            let r1 = await getDisksInfo({ platform: 'win32', statfs: undefined })
            let r2 = await getDisksInfo({ platform: 'win32' })
            assert.strict.deepEqual(r1.map((v) => v.name), r2.map((v) => v.name))
        })

        it('未給timeoutDrive時預設3000, 超過上限時以上限計且不發出TimeoutOverflowWarning', async function() {
            let warnings = []
            let onWarning = (w) => {
                warnings.push(w.name)
            }
            process.on('warning', onWarning)
            try {
                //預設值3000: 永不回應之代號於約3秒後略過
                let t0 = performance.now()
                let r0 = await getDisksInfo({ platform: 'win32', statfs: createStatfs({ 'C:\\': statC, 'Z:\\': 'hang' }) })
                let ms0 = performance.now() - t0
                assert.strict.deepEqual(r0.map((v) => v.name), ['C:'])
                assert.ok(ms0 >= 2900 && ms0 < 6000, `ms0=${ms0}`)
                let slowC = () => delay(100).then(() => statC)
                for (let timeoutDrive of [undefined, 0, -1, 'abc']) {
                    let r = await getDisksInfo({ platform: 'win32', statfs: createStatfs({ 'C:\\': slowC }), timeoutDrive })
                    assert.strict.deepEqual(r.map((v) => v.name), ['C:'], `timeoutDrive=${timeoutDrive}`)
                }
                let fastC = () => delay(5).then(() => statC)
                let r = await getDisksInfo({ platform: 'win32', statfs: createStatfs({ 'C:\\': fastC }), timeoutDrive: Number.MAX_SAFE_INTEGER })
                assert.strict.deepEqual(r.map((v) => v.name), ['C:'])
                await delay(10) //warning事件於下一輪派送
                assert.ok(!warnings.includes('TimeoutOverflowWarning'), JSON.stringify(warnings))
            }
            finally {
                process.off('warning', onWarning)
            }
        })

        it('系統時間往回或往前調整不影響逾時判定', async function() {
            let real = Date.now
            //往回: 已逾時之卡住代號於後續呼叫仍立即略過
            let statfs = createStatfs({ 'C:\\': statC, 'Z:\\': 'hang' })
            await getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 60 })
            await withDateNow(() => real() - 3600 * 1000, async () => {
                let t1 = performance.now()
                let r = await getDisksInfo({ platform: 'win32', statfs, timeoutDrive: 60 })
                assert.strict.deepEqual(r.map((v) => v.name), ['C:'])
                assert.ok(performance.now() - t1 < 50)
            })
            assert.strict.equal(statfs.calls.filter((p) => p === 'Z:\\').length, 1)
            //往前: 加入進行中之健康請求者仍取得該碟
            let statfs2 = createStatfs({ 'C:\\': () => delay(30).then(() => statC) })
            let pm1 = getDisksInfo({ platform: 'win32', statfs: statfs2, timeoutDrive: 1000 })
            let r2 = await withDateNow(() => real() + 3600 * 1000, () => getDisksInfo({ platform: 'win32', statfs: statfs2, timeoutDrive: 1000 }))
            assert.strict.deepEqual(r2.map((v) => v.name), ['C:'])
            assert.strict.deepEqual((await pm1).map((v) => v.name), ['C:'])
        })

        it('呼叫結束後不殘留計時器', async function() {
            await Promise.resolve() //mocha之測試逾時計時器於首次await後才建立, 先讓出一輪使其納入基準
            let n0 = countTimers()
            await getDisksInfo({ platform: 'win32', statfs: createStatfs({ 'C:\\': statC }) })
            await getDisksInfo({ platform: 'win32', statfs: createStatfs({ 'C:\\': statC, 'Z:\\': 'hang' }), timeoutDrive: 30 })
            assert.ok(countTimers() <= n0, `timers ${n0} -> ${countTimers()}`)
        })

        it('全部代號皆不存在時resolve空陣列', async function() {
            let statfs = createStatfs({})
            let r = await getDisksInfo({ platform: 'win32', statfs })
            assert.strict.deepEqual(r, [])
        })

        it('statfs不可用(Node.js<18.15.0)時reject並說明需求版本', async function() {
            await assert.rejects(getDisksInfo({ platform: 'win32', statfs: null }), /requires Node\.js >= 18\.15\.0/)
        })

    })

})
