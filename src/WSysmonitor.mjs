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
