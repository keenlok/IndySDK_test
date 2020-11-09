const express = require('express')
let bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 4000
const path = require('path')
const routes = require('./faber/routes')


app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', routes.main)

app.post('/create_did', routes.createDid)
app.post('/create_did_ext', routes.createDidExt)

app.get('/create_transcript', routes.createTranscript)
app.post('/create_offer' ,routes.createTranscriptOffer)
app.post('/submit_transcript', routes.submitTranscript)

app.listen(port, () => {
    console.log(`Faber listening at ${port}`)
})