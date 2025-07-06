import assert from 'assert'
import _ from 'lodash-es'
import wsm from '../src/WSysmonitor.mjs'


describe('WSysmonitor', function() {

    let ks = ['cpuInfo', 'cpuCount', 'cpuUsedPercentage', 'cpuModel', 'disksInfo', 'diskCount', 'diskTotal', 'diskFree', 'diskUsed', 'diskUsedPercentage', 'memInfo', 'memFree', 'memTotal', 'memUsed', 'memUsedPercentage', 'heapInfo', 'heapTotal', 'heapFree', 'heapUsed', 'heapUsedPercentage', 'netsInfo', 'osPlatform', 'osUptime', 'osHostname', 'osType', 'osArch', 'osMachine', 'userInfo']

    it('test', async function() {
        let d = await wsm()
        let r = _.keys(d)
        let rr = ks
        assert.strict.deepEqual(r, rr)
    })

})
