const indy_api = require('../api')
const faber_utils = require('./utils')

let poolHandle, faberWallet, faberDid, faberStewardKey
let stewardVerKey
let isSteward = false

let faberCredDefId, faberCredDefJson
let credDefSetup = false

const name = 'Faber'

async function main(req, res, next) {
    if (!isSteward) {
        [faberDid, faberWallet, faberStewardKey, stewardVerKey, poolHandle] = await faber_utils.setup_trust_anchor()
        console.log(faberDid, faberWallet, faberStewardKey, stewardVerKey)
        isSteward = true
        req.query = {}
    }
    console.log(req.query)
    if (req.query.success === {} || req.query.success === null || req.query.success == undefined) {
        res.render('pages/faber', {
            name: name,
            did: faberDid,
            isSteward: isSteward,
            key: faberStewardKey,
            walletid: faberWallet
        })
    } else {
        if (req.query.success === '0') {
            res.render('pages/faber', {
                name: name,
                did: faberDid,
                isSteward: isSteward,
                key: faberStewardKey,
                walletid: faberWallet,
                message: "DID registration Failed"
            })
        } else if (req.query.success === '1') {
            res.render('pages/faber', {
                name: name,
                did: faberDid,
                isSteward: isSteward,
                key: faberStewardKey,
                walletid: faberWallet,
                message: "DID registration completed successfully"
            })
        }
    }
}

async function createDid (req, res, next) {
    console.log(req.body)
    let newDid = req.body.did
    let newDidVerkey = req.body.verkey
    const success_str = 'success'
    const return_str = `did=${newDid}&verkey=${newDidVerkey}`
    let to_send = ''
    try {
        await indy_api.sendNym(poolHandle, faberWallet, faberDid, newDid, newDidVerkey, null)
        to_send = success_str + '=1&'
    } catch (e) {
        to_send = success_str + '=0&'
    }
    // let encoded = encodeURIComponent(to_send+return_str)
    let encoded = to_send+return_str
    console.log(encoded)
    res.redirect('/?'+ encoded)
}

async function createDidExt(req, res, next) {
    console.log("What's this", req.body)
    let newDid = req.body.did
    let verkey = req.body.verkey
    console.log(`poolhandle ${poolHandle}`)
    console.log("Registering new DID on the ledger")
    const success_str = 'success'
    const return_str = `did=${newDid}&verkey=${verkey}`
    let to_send = ''
    try {
        await indy_api.sendNym(poolHandle, faberWallet, faberDid, newDid, verkey, null)
        to_send = success_str + '=1&'
    } catch (e) {
        to_send = success_str + '=0&'
    }
    let to_encode = to_send + return_str
    res.redirect('/?'+ to_encode)
}

async function createTranscript(req, res, next) {
    if (!credDefSetup) {
        let [credDefId, credDefJson] = await faber_utils.setupCredentialDefinitions(poolHandle, faberDid, faberWallet)
        faberCredDefId = credDefId
        faberCredDefJson = credDefJson
        credDefSetup = true
    }
    if (typeof req.query.offer !== 'undefined' && req.query.offer !== '') {
        let offer = req.query.offer
        console.log(offer)
        res.render('pages/faber_transcript', {
            name: name,
            credId: faberCredDefId,
            offer: offer
        })
    } else if (typeof req.query.credential !== 'undefined') {
        console.log("Showing created credential")
        res.render('pages/faber_transcript', {
            name: name,
            credId: faberCredDefId,
            credential: req.query.credential
        })
    } else {
        res.render('pages/faber_transcript', {
            name: name,
            credId: faberCredDefId // This need to be revealed to the holder for them to create a request
        })
    }
}

async function createTranscriptOffer(req, res, next) {
    console.log("Creating Transcript offer", req.body)
    let did = req.body.offer_did
    let credOfferJson = await faber_utils.createCredentialOffer(poolHandle, faberDid, faberStewardKey, faberWallet,
        faberCredDefId, did)
    console.log(credOfferJson)
    res.redirect('/create_transcript?offer=' + JSON.stringify(credOfferJson))
}

async function submitTranscript(req, res, next) {
    console.log(req.body)
    let to_submit = {
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        degree: req.body.degree,
        status: req.body.status,
        ssn: req.body.ssn,
        year: req.body.year,
        average: req.body.average,
    }
    let offer = JSON.parse(req.body.cred_offer)
    let request = JSON.parse(req.body.cred_req)
    console.log(request)
    console.log("Parsing Request Data")
    // let req_data = JSON.parse(request['req_json'])
    let req_data = request
    console.log(req_data)
    let credJson = await faber_utils.createCredential(to_submit, faberWallet, offer, req_data)
    console.log("Created credential", credJson)
    res.redirect('/create_transcript?credential=' + JSON.stringify(credJson))
}

module.exports = {
    main,
    createDid,
    createDidExt,
    createTranscript,
    createTranscriptOffer,
    submitTranscript
}