import wsm from './src/WSysmonitor.mjs'
// import wsm from './dist/w-sysmonitor.umd.js'

wsm()
    .then((r) => {
        console.log(r)
        // => {
        //   cpuInfo: {
        //     totalIdle: 619133495,
        //     totalTick: 725060735,
        //     avgIdle: 77391686.875,
        //     avgTotal: 90632591.875
        //   },
        //   cpuCount: 8,
        //   cpuUsedPercentage: 3.87,
        //   cpuModel: 'Intel(R) Core(TM) i7-10510U CPU @ 1.80GHz',
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
        //   heapInfo: {
        //     total_heap_size: 7385088,
        //     total_heap_size_executable: 524288,
        //     total_physical_size: 7385088,
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
        //   heapTotal: 4.046875,
        //   heapFree: 4.041536159813404,
        //   heapUsed: 0.005338840186595917,
        //   heapUsedPercentage: 0.1319250084718682,
        //   netsInfo: {
        //     'Wi-Fi': [ [Object], [Object] ],
        //   },
        //   osPlatform: 'win32',
        //   osUptime: 153059,
        //   osHostname: 'DESKTOP-6R7USAO',
        //   osType: 'Windows_NT',
        //   osArch: 'x64',
        //   osMachine: 'x86_64',
        //   userInfo: {
        //     uid: -1,
        //     gid: -1,
        //     username: 'username',
        //     homedir: 'C:\\Users\\username',
        //     shell: null
        //   }
        // }
    })
    .catch((err) => {
        console.log(err)
    })

//node --experimental-modules --es-module-specifier-resolution=node ./g.mjs
