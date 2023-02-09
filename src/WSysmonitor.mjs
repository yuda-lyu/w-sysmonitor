import v8 from 'v8'
import os from 'node:os'
// import process from 'node:process'
import osu from 'node-os-utils'
import nodeDiskInfo from 'node-disk-info'
import get from 'lodash/get'
import isNumber from 'lodash/isNumber'


let cv = 1024 * 1024 * 1024 //byte -> g


/**
 * 系統資訊監控
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {String} [opt.timeCpuUsage=200] 輸入偵測CPU使用率時取樣時間數字，單位ms，預設200
 * @returns {Object} 回傳操作資料庫物件，各事件功能詳見說明
 */
async function WSysmonitor(opt = {}) {

    //timeCpuUsage
    let timeCpuUsage = get(opt, 'timeCpuUsage')
    if (!isNumber(timeCpuUsage)) {
        timeCpuUsage = 200
    }

    // let cpuUsage = process.cpuUsage()

    let cpu = osu.cpu

    let cpuInfo = cpu.average()
    let cpuCount = cpu.count()
    let cpuUsedPercentage = ''
    await cpu.usage(timeCpuUsage) //interval是等待回應ms, 故得要考慮呼叫頻率再設定
        .then((r) => {
            cpuUsedPercentage = r
        })
        .catch((err) => {
            console.log('catch cpu.usage', err)
        })
    let cpuModel = cpu.model()
    // let cpuLoadavg = cpu.loadavg()
    // let cpuLoadavgTime = cpu.loadavgTime(1)
    // let cpuLoadavg = os.loadavg() //windows無效

    let mem = osu.mem

    let memInfo = ''
    let memFree = 0
    // let memFreePercentage = 0
    let memTotal = 0
    let memUsed = 0
    let memUsedPercentage = 0
    await mem.info()
        .then((r) => {
            memInfo = r
            memFree = r.freeMemMb / 1024 //mb -> g
            memTotal = r.totalMemMb / 1024 //mb -> g
            memUsed = r.usedMemMb / 1024 //mb -> g
            // memFreePercentage = r.freeMemPercentage
            memUsedPercentage = r.usedMemPercentage
        })
        .catch((err) => {
            console.log('catch mem.info', err)
        })

    let heapInfo = v8.getHeapStatistics()
    // total_heap_size: Number of bytes V8 has allocated for the heap. This can grow if usedHeap needs more.
    // used_heap_size: Number of bytes in used by application data
    // total_heap_size_executable: Number of bytes for compiled bytecode and JITed code
    // heap_size_limit: The absolute limit the heap cannot exceed (default limit or --max_old_space_size)
    // total_physical_size: Committed size

    let heapTotal = heapInfo.heap_size_limit / cv //g
    let heapFree = heapInfo.total_available_size / cv //g
    let heapUsed = heapTotal - heapFree //g
    let heapUsedPercentage = heapUsed / heapTotal * 100

    // let drive = osu.drive

    // let driveInfo = ''
    // await drive.info()
    //     .then((r) => {
    //         driveInfo = r
    //     })
    //     .catch((err) => {
    //         console.log('catch drive.info', err)
    //     })

    let disksInfo = ''
    let diskCount = 0
    let diskTotal = 0
    let diskFree = 0
    let diskUsed = 0
    let diskUsedPercentage = 0
    await nodeDiskInfo.getDiskInfo() //測試大概花100ms
        .then((r) => {
            // disksInfo = r
            disksInfo = r.map((v, k) => {
                // console.log(k, v)
                // 0 Drive {
                //   _filesystem: '本機固定式磁碟',
                //   _blocks: 313855352832,
                //   _used: 200868184064,
                //   _available: 112987168768,
                //   _capacity: '64%',
                //   _mounted: 'C:'
                // }
                let vv = {
                    name: v._mounted,
                    display: v._filesystem,
                    total: v._blocks / cv, //g
                    free: v._available / cv, //g
                    used: v._used / cv, //g
                    // usedPercentageStr: v._capacity,
                    usedPercentage: v._used / v._blocks * 100,
                }
                diskTotal += vv.total
                diskFree += vv.free
                diskUsed += vv.used
                return vv
            })
            diskCount = disksInfo.length
            diskUsedPercentage = diskUsed / diskTotal * 100
        })
        .catch((err) => {
            console.log('catch nodeDiskInfo.getDiskInfo', err)
        })

    // let netstat = osu.netstat

    // let netstatStats = ''
    // await netstat.stats()
    //     .then((r) => {
    //         netstatStats = r
    //     })
    //     .catch((err) => {
    //         console.log('catch netstat.stats', err)
    //     })
    // let netstatInOut = ''
    // await netstat.inOut()
    //     .then((r) => {
    //         netstatInOut = r
    //     })
    //     .catch((err) => {
    //         console.log('catch netstat.inOut', err)
    //     })

    let netsInfo = os.networkInterfaces()

    // let os = osu.os

    // let osOos = ''
    // await os.oos()
    //     .then((r) => {
    //         osOos = r
    //     })
    //     .catch((err) => {
    //         console.log('catch os.oos', err)
    //     })
    let osPlatform = os.platform()
    let osUptime = os.uptime()
    // let osIp = os.ip()
    let osHostname = os.hostname()
    let osType = os.type()
    let osArch = os.arch()
    let osMachine = os.machine()

    let userInfo = os.userInfo()

    // let osCmd = osu.osCmd

    // let userName = ''
    // await osCmd.whoami()
    //     .then((r) => {
    //         userName = r
    //     })
    //     .catch((err) => {
    //         console.log('catch osCmd.whoami', err)
    //     })

    //rr
    let rr = {
        cpuInfo,
        cpuCount,
        // cpuUsage,
        // cpuLoadavg,
        cpuUsedPercentage,
        cpuModel,
        // cpuLoadavg,
        // cpuLoadavgTime,
        // driveInfo,
        disksInfo,
        diskCount,
        diskTotal,
        diskFree,
        diskUsed,
        diskUsedPercentage,
        memInfo,
        memFree,
        // memFreePercentage,
        memTotal,
        memUsed,
        memUsedPercentage,
        heapInfo,
        heapTotal,
        heapFree,
        heapUsed,
        heapUsedPercentage,
        netsInfo,
        // netstatStats,
        // netstatInOut,
        // osOos,
        osPlatform,
        osUptime,
        // osIp,
        osHostname,
        osType,
        osArch,
        osMachine,
        userInfo,
        // userName,
    }

    return rr
}


export default WSysmonitor
