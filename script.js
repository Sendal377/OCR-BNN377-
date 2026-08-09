const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 3000;

const ADB = process.platform === "win32"
    ? "adb.exe"
    : "adb";

function sendJSON(res, data, status = 200) {

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
    });

    res.end(JSON.stringify(data));
}

function runADB(args) {

    return new Promise((resolve, reject) => {

        const processADB = spawn(
            ADB,
            args,
            {
                windowsHide: true
            }
        );

        let stdout = "";
        let stderr = "";

        processADB.stdout.on("data", data => {
            stdout += data.toString();
        });

        processADB.stderr.on("data", data => {
            stderr += data.toString();
        });

        processADB.on("error", error => {
            reject(error);
        });

        processADB.on("close", code => {

            if (code !== 0) {

                reject(
                    new Error(
                        stderr || `ADB exit code ${code}`
                    )
                );

                return;
            }

            resolve(stdout);
        });
    });
}


/* ========================================
   SERVER
======================================== */

const server = http.createServer(async (req, res) => {

    const url = new URL(
        req.url,
        `http://${req.headers.host}`
    );


    /* =====================================
       INDEX
    ===================================== */

    if (
        url.pathname === "/" ||
        url.pathname === "/index.html"
    ) {

        const file =
            path.join(__dirname, "index.html");

        fs.readFile(file, (err, data) => {

            if (err) {

                res.writeHead(500, {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                });

                res.end(
                    "index.html tidak ditemukan"
                );

                return;
            }

            res.writeHead(200, {
                "Content-Type":
                    "text/html; charset=utf-8"
            });

            res.end(data);
        });

        return;
    }


    /* =====================================
       DEVICE
    ===================================== */

    if (url.pathname === "/api/device") {

        try {

            const output =
                await runADB([
                    "devices"
                ]);

            const lines =
                output
                    .split(/\r?\n/)
                    .map(x => x.trim())
                    .filter(Boolean);

            const devices = [];

            for (const line of lines) {

                if (
                    line.startsWith(
                        "List of devices"
                    )
                ) {
                    continue;
                }

                const parts =
                    line.split(/\s+/);

                if (parts.length >= 2) {

                    devices.push({
                        serial: parts[0],
                        state: parts[1]
                    });
                }
            }

            const connected =
                devices.some(
                    x => x.state === "device"
                );

            sendJSON(res, {
                connected,
                devices
            });

        } catch (error) {

            sendJSON(
                res,
                {
                    connected: false,
                    error: error.message
                },
                500
            );
        }

        return;
    }


    /* =====================================
       SCREENSHOT
    ===================================== */

    if (url.pathname === "/api/screenshot") {

        const adb = spawn(
            ADB,
            [
                "exec-out",
                "screencap",
                "-p"
            ],
            {
                windowsHide: true
            }
        );

        const chunks = [];

        let errorText = "";

        adb.stdout.on(
            "data",
            chunk => {
                chunks.push(chunk);
            }
        );

        adb.stderr.on(
            "data",
            chunk => {
                errorText +=
                    chunk.toString();
            }
        );

        adb.on(
            "error",
            error => {

                sendJSON(
                    res,
                    {
                        error:
                            error.message
                    },
                    500
                );
            }
        );

        adb.on(
            "close",
            code => {

                if (code !== 0) {

                    sendJSON(
                        res,
                        {
                            error:
                                errorText ||
                                "ADB gagal."
                        },
                        500
                    );

                    return;
                }

                const image =
                    Buffer.concat(chunks);

                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            "image/png",

                        "Access-Control-Allow-Origin":
                            "*",

                        "Cache-Control":
                            "no-cache, no-store, must-revalidate",

                        "Pragma":
                            "no-cache",

                        "Expires":
                            "0"
                    }
                );

                res.end(image);
            }
        );

        return;
    }


    /* =====================================
       404
    ===================================== */

    res.writeHead(404, {
        "Content-Type":
            "text/plain; charset=utf-8"
    });

    res.end("404 Not Found");
});


server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "      MUTASI ADB BRIDGE"
        );

        console.log(
            "======================================"
        );

        console.log("");

        console.log(
            `Dashboard: http://localhost:${PORT}`
        );

        console.log("");

        console.log(
            "ADB:",
            ADB
        );

        console.log("");

        console.log(
            "Tekan CTRL+C untuk berhenti."
        );

        console.log("");
    }
);
