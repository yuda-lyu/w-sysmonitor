import v8 from 'v8'
import os from 'node:os'
// import process from 'node:process'
import osu from 'node-os-utils'
import nodeDiskInfo from 'node-disk-info'
import get from 'lodash-es/get.js'
import isNumber from 'lodash-es/isNumber.js'


let cv = 1024 * 1024 * 1024 //byte -> g


/**
 * 系統資訊監控
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.timeCpuUsage=200] 輸入偵測CPU使用率時取樣時間數字，單位ms，預設200
 * @returns {Object} 回傳系統資訊物件
 * @example
 *
 * import wsm from 'w-sysmonitor'
 *
 * wsm()
 *     .then((r) => {
 *         console.log(r)
 *         // => {
 *         //   cpuInfo: {
 *         //     totalIdle: 619133495,
 *         //     totalTick: 725060735,
 *         //     avgIdle: 77391686.875,
 *         //     avgTotal: 90632591.875
 *         //   },
 *         //   cpuCount: 8,
 *         //   cpuUsedPercentage: 3.87,
 *         //   cpuModel: 'Intel(R) Core(TM) i7-10510U CPU @ 1.80GHz',
 *         //   disksInfo: [
 *         //     {
 *         //       name: 'C:',
 *         //       display: '本機固定式磁碟',
 *         //       total: 292.30057525634766,
 *         //       free: 105.25997543334961,
 *         //       used: 187.04059982299805,
 *         //       usedPercentage: 63.9891316186988
 *         //     },
 *         //     {
 *         //       name: 'D:',
 *         //       display: '本機固定式磁碟',
 *         //       total: 660.8984336853027,
 *         //       free: 124.43569946289062,
 *         //       used: 536.4627342224121,
 *         //       usedPercentage: 81.17173636363275
 *         //     },
 *         //     {
 *         //       name: 'G:',
 *         //       display: '本機固定式磁碟',
 *         //       total: 102,
 *         //       free: 83.06204223632812,
 *         //       used: 18.937957763671875,
 *         //       usedPercentage: 18.566625258501837
 *         //     }
 *         //   ],
 *         //   diskCount: 3,
 *         //   diskTotal: 1055.1990089416504,
 *         //   diskFree: 312.75771713256836,
 *         //   diskUsed: 742.441291809082,
 *         //   diskUsedPercentage: 70.36030981053896,
 *         //   memInfo: {
 *         //     totalMemMb: 16182.2,
 *         //     usedMemMb: 10579.27,
 *         //     freeMemMb: 5602.93,
 *         //     usedMemPercentage: 65.38,
 *         //     freeMemPercentage: 34.62
 *         //   },
 *         //   memFree: 5.471611328125,
 *         //   memTotal: 15.8029296875,
 *         //   memUsed: 10.331318359375,
 *         //   memUsedPercentage: 65.38,
 *         //   heapInfo: {
 *         //     total_heap_size: 7385088,
 *         //     total_heap_size_executable: 524288,
 *         //     total_physical_size: 7385088,
 *         //     total_available_size: 4339566408,
 *         //     used_heap_size: 5561400,
 *         //     heap_size_limit: 4345298944,
 *         //     malloced_memory: 262256,
 *         //     peak_malloced_memory: 7010040,
 *         //     does_zap_garbage: 0,
 *         //     number_of_native_contexts: 2,
 *         //     number_of_detached_contexts: 0,
 *         //     total_global_handles_size: 8192,
 *         //     used_global_handles_size: 5856,
 *         //     external_memory: 666592
 *         //   },
 *         //   heapTotal: 4.046875,
 *         //   heapFree: 4.041536159813404,
 *         //   heapUsed: 0.005338840186595917,
 *         //   heapUsedPercentage: 0.1319250084718682,
 *         //   netsInfo: {
 *         //     'Wi-Fi': [ [Object], [Object] ],
 *         //   },
 *         //   osPlatform: 'win32',
 *         //   osUptime: 153059,
 *         //   osHostname: 'DESKTOP-6R7USAO',
 *         //   osType: 'Windows_NT',
 *         //   osArch: 'x64',
 *         //   osMachine: 'x86_64',
 *         //   userInfo: {
 *         //     uid: -1,
 *         //     gid: -1,
 *         //     username: 'username',
 *         //     homedir: 'C:\\Users\\username',
 *         //     shell: null
 *         //   }
 *         // }
 *     })
 *     .catch((err) => {
 *         console.log(err)
 *     })
 *
 */
async function WSysmonitor(opt = {}) {

    //timeCpuUsage
    let timeCpuUsage = get(opt, 'timeCpuUsage')
    if (!isNumber(timeCpuUsage)) {
        timeCpuUsage = 200
    }

    // let cpuUsage = process.cpuUsage()

    //cpu
    let cpu = ''
    try {
        cpu = osu.cpu
    }
    catch (err) {}

    //cpuInfo
    let cpuInfo = {
        totalIdle: '',
        totalTick: '',
        avgIdle: '',
        avgTotal: '',
    }
    try {
        cpuInfo = cpu.average()
    }
    catch (err) {}
    //   cpuInfo: {
    //     totalIdle: 619133495,
    //     totalTick: 725060735,
    //     avgIdle: 77391686.875,
    //     avgTotal: 90632591.875
    //   },

    //cpuCount
    let cpuCount = ''
    try {
        cpuCount = cpu.count()
    }
    catch (err) {}
    //   cpuCount: 8,

    //cpuUsedPercentage
    let cpuUsedPercentage = ''
    await cpu.usage(timeCpuUsage) //interval是等待回應ms, 故得要考慮呼叫頻率再設定
        .then((r) => {
            cpuUsedPercentage = r
        })
        .catch((err) => {
            console.log('catch cpu.usage', err)
        })
    //   cpuUsedPercentage: 3.87,

    // let cpuLoadavg = cpu.loadavg()
    // let cpuLoadavgTime = cpu.loadavgTime(1)
    // let cpuLoadavg = os.loadavg() //windows無效

    //cpuModel
    let cpuModel = ''
    try {
        cpuModel = cpu.model()
    }
    catch (err) {}
    //   cpuModel: 'Intel(R) Core(TM) i7-10510U CPU @ 1.80GHz',

    //disksInfo, diskCount, diskTotal, diskFree, diskUsed, diskUsedPercentage
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
    //   disksInfo: [
    //     {
    //       name: 'C:',
    //       display: '本機固定式磁碟',
    //       total: 292.30057525634766,
    //       free: 105.25997543334961,
    //       used: 187.04059982299805,
    //       usedPercentage: 63.9891316186988
    //     },
    //     {
    //       name: 'D:',
    //       display: '本機固定式磁碟',
    //       total: 660.8984336853027,
    //       free: 124.43569946289062,
    //       used: 536.4627342224121,
    //       usedPercentage: 81.17173636363275
    //     },
    //     {
    //       name: 'G:',
    //       display: '本機固定式磁碟',
    //       total: 102,
    //       free: 83.06204223632812,
    //       used: 18.937957763671875,
    //       usedPercentage: 18.566625258501837
    //     }
    //   ],
    //   diskCount: 3,
    //   diskTotal: 1055.1990089416504,
    //   diskFree: 312.75771713256836,
    //   diskUsed: 742.441291809082,
    //   diskUsedPercentage: 70.36030981053896,

    //mem
    let mem = ''
    try {
        mem = osu.mem
    }
    catch (err) {}

    //memInfo, memFree, memTotal, memUsed, memUsedPercentage
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
    //   memInfo: {
    //     totalMemMb: 16182.2,
    //     usedMemMb: 10579.27,
    //     freeMemMb: 5602.93,
    //     usedMemPercentage: 65.38,
    //     freeMemPercentage: 34.62
    //   },
    //   memFree: 5.471611328125,
    //   memTotal: 15.8029296875,
    //   memUsed: 10.331318359375,
    //   memUsedPercentage: 65.38,

    //heapInfo
    let heapInfo = ''
    try {
        heapInfo = v8.getHeapStatistics()
        // total_heap_size: Number of bytes V8 has allocated for the heap. This can grow if usedHeap needs more.
        // used_heap_size: Number of bytes in used by application data
        // total_heap_size_executable: Number of bytes for compiled bytecode and JITed code
        // heap_size_limit: The absolute limit the heap cannot exceed (default limit or --max_old_space_size)
    }
    catch (err) {}
    //   heapInfo: {
    //     total_heap_size: 7385088,
    //     total_heap_size_executable: 524288,
    //     total_physical_size: 7385088, // total_physical_size: Committed size
    //     total_available_size: 4339566408,
    //     used_heap_size: 5561400,
    //     heap_size_limit: 4345298944,
    //     malloced_memory: 262256,
    //     peak_malloced_memory: 7010040,
    //     does_zap_garbage: 0,
    //     number_of_native_contexts: 2,
    //     number_of_detached_contexts: 0,
    //     total_global_handles_size: 8192,
    //     used_global_handles_size: 5856,
    //     external_memory: 666592
    //   },

    // heapTotal, heapFree, heapUsed, heapUsedPercentage
    let heapTotal = ''
    try {
        heapTotal = heapInfo.heap_size_limit / cv //g
    }
    catch (err) {}
    let heapFree = ''
    try {
        heapFree = heapInfo.total_available_size / cv //g
    }
    catch (err) {}
    let heapUsed = ''
    try {
        heapUsed = heapTotal - heapFree //g
    }
    catch (err) {}
    let heapUsedPercentage = ''
    try {
        heapUsedPercentage = heapUsed / heapTotal * 100
    }
    catch (err) {}
    //   heapTotal: 4.046875,
    //   heapFree: 4.041536159813404,
    //   heapUsed: 0.005338840186595917,
    //   heapUsedPercentage: 0.1319250084718682,

    //netsInfo
    let netsInfo = ''
    try {
        netsInfo = os.networkInterfaces()
    }
    catch (err) {}
    //   netsInfo: {
    //     'Wi-Fi': [ [Object], [Object] ],
    //   },

    // let os = osu.os

    // let osOos = ''
    // await os.oos()
    //     .then((r) => {
    //         osOos = r
    //     })
    //     .catch((err) => {
    //         console.log('catch os.oos', err)
    //     })

    //osPlatform, osUptime, osHostname, osType, osArch, osMachine
    let osPlatform = ''
    try {
        osPlatform = os.platform()
    }
    catch (err) {}
    let osUptime = ''
    try {
        osUptime = os.uptime()
    }
    catch (err) {}
    // let osIp = os.ip()
    let osHostname = ''
    try {
        osHostname = os.hostname()
    }
    catch (err) {}
    let osType = ''
    try {
        osType = os.type()
    }
    catch (err) {}
    let osArch = ''
    try {
        osArch = os.arch()
    }
    catch (err) {}
    let osMachine = ''
    try {
        osMachine = os.machine()
    }
    catch (err) {}
    //   osPlatform: 'win32',
    //   osUptime: 153059,
    //   osHostname: 'DESKTOP-6R7USAO',
    //   osType: 'Windows_NT',
    //   osArch: 'x64',
    //   osMachine: 'x86_64',

    // let drive = osu.drive

    // let driveInfo = ''
    // await drive.info()
    //     .then((r) => {
    //         driveInfo = r
    //     })
    //     .catch((err) => {
    //         console.log('catch drive.info', err)
    //     })

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

    //userInfo
    let userInfo = {
        uid: '',
        gid: '',
        username: '',
        homedir: '',
        shell: '',
    }
    try {
        userInfo = os.userInfo()
    }
    catch (err) {}
    //   userInfo: {
    //     uid: -1,
    //     gid: -1,
    //     username: 'username',
    //     homedir: 'C:\\Users\\username',
    //     shell: null
    //   }

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
