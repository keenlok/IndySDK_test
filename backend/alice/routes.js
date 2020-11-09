const http = require("http")

const alice_utils = require('./util')

const name = 'Alice'

let is_setup = false
let aliceWallet, personal_DID, aliceFaberKey

async function main(req, res, next) {
    if (!is_setup) {
        aliceWallet = await alice_utils.setup_wallet()
        is_setup = true
        req.query = {}
    }
    if (Object.keys(req.query).length !== 0) {
        if (typeof req.query.success !== "undefined" || typeof req.query.local_did !== "undefined") {
            console.log("parsing success")
            let message = ''
            console.log('parsing query')
            if (req.query.success === '0') {
                message = "Failed to create DID"
            } else if (req.query.success === '1') {
                message = "Successfully created DID"
                personal_DID = req.query.did
                aliceFaberKey = req.query.verkey
            } else if (req.query.local_did === '1') {
                message = "Locally created DID"
            }
            console.log(message)
            res.render('pages/alice', {
                name: name,
                did: personal_DID,
                key: aliceFaberKey,
                message: message
            })
        } else if (typeof req.query.request !== "undefined") {
            console.log("showing request")
            res.render('pages/alice', {
                name: name,
                did: personal_DID,
                key: aliceFaberKey,
                cred_request: req.query.request
            })
        }
        else {
            console.log("Something went wrong")
            console.log(typeof req.query.success)
            console.log(typeof req.query.local_did)
            console.log(typeof req.query.request)
        }
    } else {
        res.render('pages/alice', {
            name: name,
            did: personal_DID,
            key: aliceFaberKey,
        })
    }
}

async function createDid (req, res, next) {
    console.log("Creating new DID locally")
    let [did, verkey] = await alice_utils.create_did(aliceWallet)
    personal_DID = did
    aliceFaberKey = verkey
    console.log("Created DID locally")
    res.redirect('/?local_did=1')
}

async function createAndRecordDidOnLedger (req, res, next) {
    let fromDid = req.body.ta_did
    console.log("Trust Anchor Did: ", fromDid)
    let [message, options] = await alice_utils.create_new_did_request(fromDid, aliceWallet)
    const new_req = http.request(options, (res1) => {
        res1.setEncoding('utf8');
        let str = ''
        res1.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
            str += chunk
        });
        res1.on('end', () => {
            console.log('No more data in response.');
            console.log(str)
            let components = str.split(" ")
            const redirect_str = components[components.length -1]
            res.redirect(redirect_str)
        });
    })

    new_req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });
    console.log("Sending data to TA")

    // Write data to request body
    new_req.write(message);
    new_req.end();
}

async function createCredentialRequest(req, res, next) {
    console.log(req.body)
    let credOffer = req.body.cred_offer
    let issuerDid = req.body.cred_did
    console.log("credential offer", credOffer)
    let [reqJson] = await alice_utils.createCredRequest(aliceWallet, personal_DID, aliceFaberKey,
        issuerDid, credOffer)
    let toSend = JSON.stringify(reqJson)
    console.log("what is the created request", toSend)
    res.redirect('/?request=' + toSend)
}

module.exports = {
    main,
    createDid,
    createAndRecordDidOnLedger,
    createCredentialRequest
}