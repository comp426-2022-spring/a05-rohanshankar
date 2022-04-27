// Place your server entry point code here
// Require minimist module
const args = require('minimist')(process.argv.slice(2));
const port = args.port || process.env.port || 5000;
// See what is stored in the object produced by minimist
console.log(args);
// Store help text 
const help = (`
server.js [options]

--port	Set the port number for the server to listen on. Must be an integer
            between 1 and 65535.

--debug	If set to true, creates endlpoints /app/log/access/ which returns
            a JSON access log from the database and /app/error which throws 
            an error with the message "Error test successful." Defaults to 
            false.

--log		If set to false, no log files are written. Defaults to true.
            Logs are always written to database.

--help	Return this message and exit.
`)
// If --help or -h, echo help text to STDOUT and exit
if (args.help || args.h) {
    console.log(help);
    process.exit(0);
}

const express = require('express');
const app = express();
const logdb = require("./database.js");
const fs = require('fs');
const morgan = require('morgan');

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const server = app.listen(port, () => {
    console.log('App listening on port %PORT%'.replace('%PORT%', port));
});

if (args.log == 'true') {
    const WRITESTREAM = fs.createWriteStream('access.log', { flags: 'a' });
    // Set up the access logging middleware
    app.use(morgan('combined'), { stream: WRITESTREAM });
} 

app.use((req, res, next) => {
    let logdata = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    const stmt = logdb.prepare('INSERT INTO accessLog (remoteaddr, remoteuser, time, method, url, protocol, httpversion, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(logdata.remoteaddr, logdata.remoteuser, logdata.time, logdata.method, logdata.url, logdata.protocol, logdata.httpversion, logdata.status, logdata.referer, logdata.useragent);
    next();
});

if (args.debug || args.d){
    app.get('/app/log/access/', (req, res, next) => {
    const stmt = logdb.prepare('SELECT * FROM accessLog').all();
    res.status(200).json(stmt);
    })
    app.get('/app/error/', (req, res, next) => {
      throw new Error('Error');
    })
}


//------------------------------------------------------------------------
app.get('/app/', (req, res) => {
    // Respond with status 200
    res.statusCode = 200;
    // Respond with status message "OK"
    res.statusMessage = 'OK';
    res.writeHead(res.statusCode, { 'Content-Type': 'text/plain' });
    res.end(res.statusCode + ' ' + res.statusMessage)
});

app.get('/app/flip/', (req, res) => {
    const flip = coinFlip()
    res.status(200).json({'flip' : flip})
});

app.get('/app/flips/:number/', (req, res) => {
    const flips = coinFlips(req.params.number)
    const count = countFlips(flips)
    res.status(200).json({'raw' : flips, 'summary' : count})
});

app.get('/app/flip/call/heads', (req, res) => {
    res.status(200).json(flipACoin("heads"))
});

app.get('/app/flip/call/tails', (req, res) => {
    res.status(200).json(flipACoin("tails"))
});

// Default response for any other request
app.use(function (req, res) {
    res.status(404).send('404 NOT FOUND')
});


//Functions Definitions------------------------------------------------------------------------
function coinFlip() {
    if (Math.random() > .5) {
        return "heads";
    } else {
        return "tails";
    }
}


function coinFlips(flips) {
    var results = new Array(flips);
    for (let i = 0; i < flips; i++) {
        results[i] = coinFlip();
    }
    return results;
}

function countFlips(array) {
    let head = 0;
    let tail = 0;
    for (let i = 0; i < array.length; i++) {
        if (array[i] == "heads") {
            head++;
        } else {
            tail++;
        }
    }
    return {
        heads: head,
        tails: tail
    }
}

function flipACoin(call) {
    let result = coinFlip();
    if (result == call) {
        return { call: call, flip: result, result: "win" }
    } else {
        return { call: call, flip: result, result: "lose" }
    }
}