const indy = require('indy-sdk')

const indy_api = require('../api')

let poolHandle = ""

async function setup_wallet() {
    let aliceWallet
    if (!aliceWallet) {
        console.log("Setting up Alice Wallet")
        let aliceWalletConfig = {'id': 'aliceWallet'}
        let aliceWalletCredentials = {'key': 'alice_key'}
        try {
            await indy.createWallet(aliceWalletConfig, aliceWalletCredentials)
        } catch (e) {
            if (e.message !== "WalletAlreadyExistsError") {
                throw e
            }
        }
        aliceWallet = await indy.openWallet(aliceWalletConfig, aliceWalletCredentials)
        console.log("Alice wallet setup done, wallet handle: ", aliceWallet)
    }
    return aliceWallet
}

async function create_did(walletHandle) {
    let [newDid, newVerkey] = await indy.createAndStoreMyDid(walletHandle, {})
    /* By right, one would encrypt their DID and verkey with the Verkey of the Trust anchor,
    that would record the DID on the ledger but for this demonstration, we're just gonna pass
    the newly created DID to the trust anchor for the trust anchor to write on the ledger.
     */
    return [newDid, newVerkey]
}


/**
 * Registers a DID with Faber server
 * @param trust_anchor_did Faber's DID
 */
async function create_new_did_request(trust_anchor_did, myWalletHandle) {
    console.log(`New trust anchor DID ${trust_anchor_did}, creating request to register 
        DID with trust anchor`)
    console.log(`Wallet handle, ${myWalletHandle}, ${typeof myWalletHandle}`)
    let [newDid, newVerkey] = await indy.createAndStoreMyDid(myWalletHandle, {})
    let poolName = 'sandbox';
    poolHandle = await indy.openPoolLedger(poolName);
    console.log("Opening pool ledger, ", poolHandle)

    console.log("Getting trust anchor verkey")
    let trust_anchor_verkey = await indy.keyForDid(poolHandle, myWalletHandle, trust_anchor_did)
    console.log("Obtained trust anchor verkey", trust_anchor_verkey)
    let connectionResponse = JSON.stringify({
        'did': newDid,
        'verkey': newVerkey,
        'nonce': 123456
    })
    /*
    In an actual scenario, the agent will have to query the Verifiable Data registry to get
    the actual website to post the request to but in this scenario its hard-coded in.
     */
    console.log("Creating encrypted response to Trust anchor")
    let anoncryptedConnectionResponse = await indy.cryptoAnonCrypt(trust_anchor_verkey,
        Buffer.from(connectionResponse, 'utf8'))
    // the encryption works but I cannot send it. The receiving end will complain about
    // unrecognised characters...
    console.log(anoncryptedConnectionResponse)
    let options = {
        host: '192.168.100.114',
        port: 4000,
        path: '/create_did_ext',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 'Content-Length': Buffer.byteLength(anoncryptedConnectionResponse)
            'Content-Length': Buffer.byteLength(connectionResponse)
        }
    }
    return [connectionResponse, options]
}

async function createCredRequest(myWalletHandle, myDid, myVerKey, issuerDid, credOffer) {
    let aliceMasterSecretId = await indy.proverCreateMasterSecret(myWalletHandle, null);

    if (poolHandle === "") {
        try {
            let poolName = 'sandbox';
            poolHandle = await indy.openPoolLedger(poolName);
            console.log("Opening pool ledger, ", poolHandle)
        } catch (e) {
            console.log(e)
        }
    }

    // console.log("Getting trust anchor verkey")
    // let issuerVerKey = await indy.keyForDid(poolHandle, myWalletHandle, issuerDid)

    let credOfferJson = JSON.parse(credOffer)
    let credDefId = credOfferJson['cred_def_id']

    console.log("Get \"Faber Transcript\" Credential Definition from Ledger");
    let faberTranscriptCredDef;
    [faberTranscriptCredDefId, faberTranscriptCredDef] = await indy_api.getCredDef(poolHandle, myDid, credDefId);

    console.log("Create \"Transcript\" Credential Request for Faber");
    let [transcriptCredRequestJson, transcriptCredRequestMetadataJson] = await indy.proverCreateCredentialReq(myWalletHandle,
        myDid, credOffer, faberTranscriptCredDef, aliceMasterSecretId);

    // console.log("\"Alice\" -> Authcrypt \"Transcript\" Credential Request for Faber");
    // let authcryptedTranscriptCredRequest = await indy.cryptoAuthCrypt(myWalletHandle, myVerKey, issuerVerKey,
    //     Buffer.from(JSON.stringify(transcriptCredRequestJson),'utf8'));

    // let credRequest = {
    //     'req_json_str': JSON.stringify(transcriptCredRequestJson),
    //     'meta_json_str': JSON.stringify(transcriptCredRequestMetadataJson)
    // }
    let credRequest = transcriptCredRequestJson

    return [credRequest]
}

module.exports = {
    setup_wallet,
    create_did,
    create_new_did_request,
    createCredRequest
}