#!/usr/bin/env node

// this patches Server classes with systemd support
require("systemd");

const {createServer} = require("..");
const tlsopt = require("tlsopt");
const {assign} = Object;

const tlsopts = tlsopt.readSync();
const secured = Boolean((tlsopts.cert && tlsopts.key) || tlsopts.pfx);
const domain = process.env.DOMAIN || "mail.example.com";
const bucket = process.env.BUCKET;
const smtpopts = assign({secured}, tlsopts);
const systemd = process.env.LISTEN_PID ? "systemd" : null;
const port = systemd || process.env.LISTEN_PORT || 25;
const server = createServer(domain, bucket, smtpopts);

server.on("error", err => {
    const msg = process.env.DEBUG ? err.stack : err.message;
    console.error(msg.replace(/\s+/g, " "));
});

server.listen(port);
