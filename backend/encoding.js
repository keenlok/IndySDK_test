/** This is a JS translation of the python code from
 * https://von-agent.readthedocs.io/en/latest/_modules/von_agent/codec.html?highlight=codec
 * based on this issue stated in the Indy SDK https://jira.hyperledger.org/browse/IS-786
 */
const util = require('util')

const ENCODE_PREFIX = {
    str: 1,
    bool: 2,
    int: 3,
    float: 4,
    none: 9
}

const I32_BOUND = Math.pow(2, 31)

function encode(raw) {
    if (typeof raw === "undefined") {
        return I32_BOUND.toString()
    }
    if (typeof raw === "number" && isInt(raw)) {
        return raw.toString()
    }
    if (typeof raw === "boolean") {
        let val = I32_BOUND
        if (raw) {
            val += 2
        } else {
            val += 1
        }
        return `${ENCODE_PREFIX.bool}${val}`
    }
    let prefix = ''
    if (isFloat(raw)) {
        prefix = ENCODE_PREFIX.float
    } else if (typeof raw === "string") {
        prefix = ENCODE_PREFIX.str
    } else {
        prefix = ENCODE_PREFIX.none
    }
    const textEncoder = new util.TextEncoder()
    let encoded = textEncoder .encode(raw.toString())
    let hexed = buf2hex(encoded)
    console.log(hexed) // The Hexed values are correct
    // However converting them from b'[hexed value]' to
    // int is a problem which i might be misunderstanding
    // the original python function is int.fromBytes()
    //
    // However, since the encoding function is not
    // fixed yet in indy this will do for now
    let final_val = hex2int(hexed) + I32_BOUND
    console.log(hexed, final_val)
    return `${prefix}${final_val}`
}

function isInt(n) {
    return Number(n) === n && n % 1 === 0;
}

function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2));
}

function hex2int(buffer) {
    let converted = buffer.map((x, index, arr) => {
        // console.log(index, arr.length)
        let formatted = '0x' + x
        let toInt = parseInt(formatted)
        let returnVal = toInt * Math.pow(256, arr.length - 1 - index)
        // console.log(x, formatted, toInt, returnVal)
        return returnVal
    })
    return converted.reduce((a, b) => a+b)
}

function cred_attr_value(raw) {
    return {'raw': (typeof raw === "undefined") ? '' : raw.toString(), 'encoded': encode(raw)}
}

module.exports = {
    cred_attr_value
}