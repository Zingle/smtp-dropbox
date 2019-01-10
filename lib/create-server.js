const {Readable} = require("stream");
const bytesized = require("bytesized");
const concat = require("concat-stream");
const s3drop = require("@zingle/s3drop");
const {SMTPServer} = require("smtp-server");
const {simpleParser} = require("mailparser");
const {assign} = Object;

/**
 * Create application server.
 * @param {string} domain
 * @param {string} bucket
 * @param {object} [smtpopts]
 * @returns {SMTPServer}
 */
function createServer(domain, bucket, smtpopts={}) {
    console.info(`creating server for ${domain}`);

    const drop = s3drop(bucket);

    return new SMTPServer(assign({}, {
        name: domain,
        banner: "send it on over",
        size: bytesized("20 MiB"),
        disabledCommands: ["AUTH"]
    }, smtpopts, {
        /**
         * @param {Readable} stream
         * @param {object} session
         * @param {function} callback
         */
        onData(stream, session, callback) {
            stream.on("error", callback).pipe(concat(buffer => {
                console.info(`received message`);

                const email = String(buffer);

                simpleParser(email, async (err, mail) => {
                    if (err) return callback(err);

                    const id = mail.messageId;
                    const to = mail.to.value[0].address;
                    const from = mail.from.value[0].address;

                    console.info(`reading message ${id} [${from} => ${to}]`);

                    for (const {filename, content} of mail.attachments) {
                        let called = false;

                        const metadata = {filename, to, from, messageId: id};

                        try {
                            const key = await drop(new Readable({read}), metadata);
                            console.info(`attachment ${id}/${filename}: ${key}`);
                        } catch (e) {
                            console.info(`attachment ${id}/${filename}: ERROR`)
                            err = err ? assign(e, {next: err}) : e;
                        }

                        function read(size) {
                            if (called || false !== this.push(content)) {
                                called = true;
                                this.push(null);
                            }
                        }
                    }

                    callback(err);
                });
            })).on("error", callback);
        },

        /**
         * @param {object} address
         * @param {string} address.address
         * @param {object} session
         * @param {function} callback
         */
        onRcptTo({address}, session, callback) {
            const acceptable = new RegExp(`@.*${domain}$`);

            if (acceptable.test(address)) {
                console.info(`mail received for ${address}`);
                callback();
            } else {
                console.info(`mail rejected for ${address}`)
                callback(new Error(`rejected recipient ${address}`));
            }
        }
    }));
}

module.exports = createServer;
