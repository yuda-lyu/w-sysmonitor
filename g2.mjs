import fs from 'fs'
import _ from 'lodash-es'
import getDiskIo from './src/getDiskIo.mjs'


let r = await getDiskIo()
console.log('r', r)


//node g2.mjs
