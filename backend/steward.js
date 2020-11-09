const express = require('express')
const app = express()
const port = 5000
const path = require('path')
const indy = require('indy-sdk')
const indy_util = require('./util')

let poolHandle, stewardDid, stewardWallet, stewardVerKey
const name = 'Steward'

app.set('view engine', 'ejs')

async function setup() {
    let poolName = 'pool1';
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

    poolHandle = await indy.openPoolLedger(poolName);

    console.log("==============================");
    console.log("=== Getting Trust Anchor credentials for Faber, Acme, Thrift and Government  ==");
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

    stewardWallet = await indy.openWallet(stewardWalletConfig, stewardWalletCredentials);

    console.log("\"Sovrin Steward\" -> Create and store in Wallet DID from seed");
    let stewardDidInfo = {
        'seed': '000000000000000000000000Steward1'
    };

    let returned_items = await indy.createAndStoreMyDid(stewardWallet, stewardDidInfo);
    console.log(returned_items)
    stewardDid = returned_items[0]
    stewardVerKey = returned_items[1]
    console.log("Steward DID obtain", stewardDid)
    console.log("Steward Wallet", stewardWallet)
}

setup()


app.get('/', (req, res) => {
    res.render('pages/steward', {
        name: name,
        did: stewardDid,
        walletid:stewardWallet,
        key: stewardVerKey,
    })
})

app.listen(port, () => {
    console.log(`Steward is listening at ${port}`)
} )
