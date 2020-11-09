const express = require('express')
let bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 3000
const path = require('path')
const routes = require("./alice/routes")

app.set('view engine', 'ejs')

app.use(express.static(__dirname + '/public'));

app.get('/', routes.main)

app.post('/create_did', routes.createDid)
app.post('/create_and_record', routes.createAndRecordDidOnLedger)

app.post('/create_cred_request', routes.createCredentialRequest)

app.listen(port, () => {
    console.log(`Alice listening at ${port}`)
})