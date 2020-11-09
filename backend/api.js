"use strict";

const indy = require('indy-sdk');

async function onboarding(poolHandle, From, fromWallet, fromDid, to, toWallet, toWalletConfig, toWalletCredentials) {
    console.log(`\"${From}\" > Create and store in Wallet \"${From} ${to}\" DID`);
    let [fromToDid, fromToKey] = await indy.createAndStoreMyDid(fromWallet, {});

    console.log(`\"${From}\" > Send Nym to Ledger for \"${From} ${to}\" DID`);
    await sendNym(poolHandle, fromWallet, fromDid, fromToDid, fromToKey, null);

    console.log(`\"${From}\" > Send connection request to ${to} with \"${From} ${to}\" DID and nonce`);
    let connectionRequest = {
        did: fromToDid,
        nonce: 123456789
    };

    if (!toWallet) {
        console.log(`\"${to}\" > Create wallet"`);
        try {
            await indy.createWallet(toWalletConfig, toWalletCredentials);
        } catch(e) {
            if(e.message !== "WalletAlreadyExistsError") {
                throw e;
            }
        }
        toWallet = await indy.openWallet(toWalletConfig, toWalletCredentials);
    }

    console.log(`\"${to}\" > Create and store in Wallet \"${to} ${From}\" DID`);
    let [toFromDid, toFromKey] = await indy.createAndStoreMyDid(toWallet, {});

    console.log(`\"${to}\" > Get key for did from \"${From}\" connection request`);
    let fromToVerkey = await indy.keyForDid(poolHandle, toWallet, connectionRequest.did);

    console.log(`\"${to}\" > Anoncrypt connection response for \"${From}\" with \"${to} ${From}\" DID, verkey and nonce`);
    let connectionResponse = JSON.stringify({
        'did': toFromDid,
        'verkey': toFromKey,
        'nonce': connectionRequest['nonce']
    });
    let anoncryptedConnectionResponse = await indy.cryptoAnonCrypt(fromToVerkey, Buffer.from(connectionResponse, 'utf8'));

    console.log(`\"${to}\" > Send anoncrypted connection response to \"${From}\"`);

    console.log(`\"${From}\" > Anondecrypt connection response from \"${to}\"`);
    let decryptedConnectionResponse = JSON.parse(Buffer.from(await indy.cryptoAnonDecrypt(fromWallet, fromToKey, anoncryptedConnectionResponse)));

    console.log(`\"${From}\" > Authenticates \"${to}\" by comparision of Nonce`);
    if (connectionRequest['nonce'] !== decryptedConnectionResponse['nonce']) {
        throw Error("nonces don't match!");
    }

    console.log(`\"${From}\" > Send Nym to Ledger for \"${to} ${From}\" DID`);
    await sendNym(poolHandle, fromWallet, fromDid, decryptedConnectionResponse['did'], decryptedConnectionResponse['verkey'], null);

    return [toWallet, fromToKey, toFromDid, toFromKey, decryptedConnectionResponse];
}

async function getVerinym(poolHandle, From, fromWallet, fromDid, fromToKey, to, toWallet, toFromDid, toFromKey, role) {
    console.log(`\"${to}\" > Create and store in Wallet \"${to}\" new DID"`);
    let [toDid, toKey] = await indy.createAndStoreMyDid(toWallet, {});

    console.log(`\"${to}\" > Authcrypt \"${to} DID info\" for \"${From}\"`);
    let didInfoJson = JSON.stringify({
        'did': toDid,
        'verkey': toKey
    });
    let authcryptedDidInfo = await indy.cryptoAuthCrypt(toWallet, toFromKey, fromToKey, Buffer.from(didInfoJson, 'utf8'));

    console.log(`\"${to}\" > Send authcrypted \"${to} DID info\" to ${From}`);

    console.log(`\"${From}\" > Authdecrypted \"${to} DID info\" from ${to}`);
    let [senderVerkey, authdecryptedDidInfo] =
        await indy.cryptoAuthDecrypt(fromWallet, fromToKey, Buffer.from(authcryptedDidInfo));

    let authdecryptedDidInfoJson = JSON.parse(Buffer.from(authdecryptedDidInfo));
    console.log(`\"${From}\" > Authenticate ${to} by comparision of Verkeys`);
    let retrievedVerkey = await indy.keyForDid(poolHandle, fromWallet, toFromDid);
    if (senderVerkey !== retrievedVerkey) {
        throw Error("Verkey is not the same");
    }

    console.log(`\"${From}\" > Send Nym to Ledger for \"${to} DID\" with ${role} Role`);
    await sendNym(poolHandle, fromWallet, fromDid, authdecryptedDidInfoJson['did'], authdecryptedDidInfoJson['verkey'], role);

    return toDid;
}

async function sendNym(poolHandle, walletHandle, Did, newDid, newKey, role) {
    let nymRequest = await indy.buildNymRequest(Did, newDid, newKey, null, role);
    await indy.signAndSubmitRequest(poolHandle, walletHandle, Did, nymRequest);
}

async function sendSchema(poolHandle, walletHandle, Did, schema) {
    // schema = JSON.stringify(schema); // FIXME: Check JSON parsing
    let schemaRequest = await indy.buildSchemaRequest(Did, schema);
    await indy.signAndSubmitRequest(poolHandle, walletHandle, Did, schemaRequest)
}

async function sendCredDef(poolHandle, walletHandle, did, credDef) {
    let credDefRequest = await indy.buildCredDefRequest(did, credDef);
    await indy.signAndSubmitRequest(poolHandle, walletHandle, did, credDefRequest);
}

async function getSchema(poolHandle, did, schemaId) {
    let getSchemaRequest = await indy.buildGetSchemaRequest(did, schemaId);
    let getSchemaResponse = await indy.submitRequest(poolHandle, getSchemaRequest);
    return await indy.parseGetSchemaResponse(getSchemaResponse);
}

async function getCredDef(poolHandle, did, schemaId) {
    let getCredDefRequest = await indy.buildGetCredDefRequest(did, schemaId);
    let getCredDefResponse = await indy.submitRequest(poolHandle, getCredDefRequest);
    return await indy.parseGetCredDefResponse(getCredDefResponse);
}

async function proverGetEntitiesFromLedger(poolHandle, did, identifiers, actor) {
    let schemas = {};
    let credDefs = {};
    let revStates = {};

    for(let referent of Object.keys(identifiers)) {
        let item = identifiers[referent];
        console.log(`\"${actor}\" -> Get Schema from Ledger`);
        let [receivedSchemaId, receivedSchema] = await getSchema(poolHandle, did, item['schema_id']);
        schemas[receivedSchemaId] = receivedSchema;

        console.log(`\"${actor}\" -> Get Claim Definition from Ledger`);
        let [receivedCredDefId, receivedCredDef] = await getCredDef(poolHandle, did, item['cred_def_id']);
        credDefs[receivedCredDefId] = receivedCredDef;

        if (item.rev_reg_seq_no) {
            // TODO Create Revocation States
        }
    }

    return [schemas, credDefs, revStates];
}

async function verifierGetEntitiesFromLedger(poolHandle, did, identifiers, actor) {
    let schemas = {};
    let credDefs = {};
    let revRegDefs = {};
    let revRegs = {};

    for(let referent of Object.keys(identifiers)) {
        let item = identifiers[referent];
        console.log(`"${actor}" -> Get Schema from Ledger`);
        let [receivedSchemaId, receivedSchema] = await getSchema(poolHandle, did, item['schema_id']);
        schemas[receivedSchemaId] = receivedSchema;

        console.log(`"${actor}" -> Get Claim Definition from Ledger`);
        let [receivedCredDefId, receivedCredDef] = await getCredDef(poolHandle, did, item['cred_def_id']);
        credDefs[receivedCredDefId] = receivedCredDef;

        if (item.rev_reg_seq_no) {
            // TODO Get Revocation Definitions and Revocation Registries
        }
    }

    return [schemas, credDefs, revRegDefs, revRegs];
}

async function authDecrypt(walletHandle, key, message) {
    let [fromVerkey, decryptedMessageJsonBuffer] = await indy.cryptoAuthDecrypt(walletHandle, key, message);
    let decryptedMessage = JSON.parse(decryptedMessageJsonBuffer);
    let decryptedMessageJson = JSON.stringify(decryptedMessage);
    return [fromVerkey, decryptedMessageJson, decryptedMessage];
}

module.exports = {
    onboarding,
    getVerinym,
    sendNym,
    sendSchema,
    sendCredDef,
    getCredDef,
    getSchema,
    proverGetEntitiesFromLedger,
    verifierGetEntitiesFromLedger,
    authDecrypt
}
