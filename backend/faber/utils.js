const indy = require('indy-sdk')
const indy_util = require('../util')
const indy_api = require('../api')
const {cred_attr_value} = require('../encoding')

/**
 * Sets up Faber as an trust anchor
 */
async function setup_trust_anchor() {
    console.log("==============================");
    console.log("=== Setting up Faber as Trust Anchor  ==");
    console.log("------------------------------");

    let poolName = 'sandbox';
    console.log(`Open Pool Ledger: ${poolName}`);
    let poolGenesisTxnPath = await indy_util.getPoolGenesisTxnPath(poolName);
    let poolConfig = {
        "genesis_txn": poolGenesisTxnPath
    };
    try {
        await indy.createPoolLedgerConfig(poolName, poolConfig);
    } catch(e) {
        if(e.message !== "PoolLedgerConfigAlreadyExistsError") {
            throw e;
        }
    }

    await indy.setProtocolVersion(2)

    let poolHandle = await indy.openPoolLedger(poolName);

    console.log("==============================");
    console.log("=== Getting Trust Anchor credentials for Faber  ==");
    console.log("------------------------------");

    console.log("\"Sovrin Steward\" -> Create wallet");
    let stewardWalletConfig = {'id': 'stewardWalletName'}
    let stewardWalletCredentials = {'key': 'steward_key'}
    try {
        await indy.createWallet(stewardWalletConfig, stewardWalletCredentials)
    } catch(e) {
        if(e.message !== "WalletAlreadyExistsError") {
            throw e;
        }
    }

    let stewardWallet = await indy.openWallet(stewardWalletConfig, stewardWalletCredentials);

    console.log("\"Sovrin Steward\" -> Create and store in Wallet DID from seed");
    let stewardDidInfo = {
        'seed': '000000000000000000000000Steward1'
    };

    let [stewardDid,] = await indy.createAndStoreMyDid(stewardWallet, stewardDidInfo);

    console.log("==============================");
    console.log("== Getting Trust Anchor credentials - Faber Onboarding  ==");
    console.log("------------------------------");

    let faberWalletConfig = {'id': 'faberWallet'}
    let faberWalletCredentials = {'key': 'faber_key'}
    let [faberWallet, stewardFaberKey, faberStewardDid, faberStewardKey] = await indy_api.onboarding(poolHandle, "Sovrin Steward", stewardWallet, stewardDid, "Faber", null, faberWalletConfig, faberWalletCredentials);

    console.log("==============================");
    console.log("== Getting Trust Anchor credentials - Faber getting Verinym  ==");
    console.log("------------------------------");

    let faberDid = await indy_api.getVerinym(poolHandle, "Sovrin Steward", stewardWallet, stewardDid, stewardFaberKey,
        "Faber", faberWallet, faberStewardDid, faberStewardKey, 'TRUST_ANCHOR');

    return [faberDid, faberWallet, faberStewardKey, stewardFaberKey, poolHandle]
}

/**
 * Sets up the values required to issue a credential to other entities.
 * A little different from how the Indy SDK guide does it:
 *   - The intro guide has the government write the schema and an issuer get the schema from
 *   the ledger to write the credential definition to the ledger.
 *   - Here the issuer writes his own schema and definition to the ledger, just to reduce the 
 *   number of actors for this demo.
 *   
 * Can be abstracted further for real use cases
 */
async function setupCredentialDefinitions(poolHandle, issuerDid, issuerWallet) {
    console.log("Create \"Transcript\" Schema")
    let [transcriptSchemaId, transcriptSchema] = await indy.issuerCreateSchema(issuerDid, 'Transcript', '1.2',
        ['first_name', 'last_name', 'degree', 'status',
            'year', 'average', 'ssn'])
    console.log("Send schema to the ledger")
    await indy_api.sendSchema(poolHandle, issuerWallet, issuerDid, transcriptSchema);

    let data
    [data, transcriptSchema] = await indy_api.getSchema(poolHandle, issuerDid, transcriptSchemaId)
    
    console.log("what is this data", data)
    let [transcriptCredDefId, transcriptCredDefJson] = await indy.issuerCreateAndStoreCredentialDef(issuerWallet, issuerDid,
        transcriptSchema, 'TAG1', 'CL', '{"support_revocation": false}')
   
    console.log("Send  \"Faber Transcript\" Credential Definition to Ledger")
    await indy_api.sendCredDef(poolHandle, issuerWallet, issuerDid, transcriptCredDefJson)
    
    return [transcriptCredDefId, transcriptCredDefJson]
}

async function createCredentialOffer(poolHandle, issuerDid, issuerVerkey, issuerWallet, credDefId, holderDid) {
    console.log("\"Faber\" -> Create \"Transcript\" Credential Offer for Alice");
    let transcriptCredOfferJson = await indy.issuerCreateCredentialOffer(issuerWallet, credDefId);

    console.log("\"Faber\" -> Get key for Alice did");
    let holderVerKey = await indy.keyForDid(poolHandle, issuerWallet, holderDid);

    console.log("\"Faber\" -> Authcrypt \"Transcript\" Credential Offer for Alice");
    let authcryptedTranscriptCredOffer = await indy.cryptoAuthCrypt(issuerWallet, issuerVerkey, holderVerKey,
        Buffer.from(JSON.stringify(transcriptCredOfferJson),'utf8'));

    return transcriptCredOfferJson
}

// Create credential to be issued
async function createCredential(submitted, walletHandle, transcriptCredOfferJson, credRequestJson) {
    // let transcriptCredValues = {
    //     "first_name": cred_attr_value(submitted.firstName),
    //     "last_name": cred_attr_value(submitted.lastName),
    //     "degree": cred_attr_value(submitted.degree),
    //     "status": cred_attr_value(submitted.status),
    //     "ssn": cred_attr_value(submitted.ssn),
    //     "year": cred_attr_value(submitted.year),
    //     "average": cred_attr_value(submitted.average)
    // }
    let transcriptCredValues = {
        "first_name": {"raw": "Alice", "encoded": "1139481716457488690172217916278103335"},
        "last_name": {"raw": "Garcia", "encoded": "5321642780241790123587902456789123452"},
        "degree": {"raw": "Bachelor of Science, Marketing", "encoded": "12434523576212321"},
        "status": {"raw": "graduated", "encoded": "2213454313412354"},
        "ssn": {"raw": "123-45-6789", "encoded": "3124141231422543541"},
        "year": {"raw": "2015", "encoded": "2015"},
        "average": {"raw": "5", "encoded": "5"}
    };
    console.log("Credentials encoded", transcriptCredValues)
    console.log("Creating Credentials")
    let isCreated = false
    while (!isCreated) {
        try {
            let [transcriptCredJson] = await indy.issuerCreateCredential(walletHandle, transcriptCredOfferJson, credRequestJson, transcriptCredValues, null, -1);
            console.log("Created")
            return transcriptCredJson
        } catch (e) {
            console.log("e??", e)
        }
    }

}

module.exports = {
    createCredential,
    setupCredentialDefinitions,
    createCredentialOffer,
    setup_trust_anchor
}
