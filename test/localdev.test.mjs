import assert from 'assert'
import _ from 'lodash-es'
import wsm from '../src/WSysmonitor.mjs'
import rout from './rout.json' assert {type:'json'}


describe('localdev', function() {

    it('test in local', async function() {
        let r = await wsm()
        let rin = _.keys(r)
        assert.strict.deepEqual(rin, rout)
    })

})
