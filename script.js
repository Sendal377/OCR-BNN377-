const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 3000;

// ===============================
// CARI ADB
// ===============================
const ADB = process.platform === "win32"
    ? "adb.exe"
    : "adb";

// ===============================
// JALANKAN ADB
// ===============================
function runADB(args, callback) {
    execFile(ADB, args, {
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024
    }, callback);
}

// ===============================
// SERVER
// ===============================
const server = http.createServer((req, res) => {

    // ===========================
    // HALAMAN UTAMA
    // ===========================
    if (req.url === "/" || req.url === "/index.html") {

        const file = path.join(__dirname, "index.html");

        fs.readFile(file, (err, data) => {

            if (err) {
                res.writeHead(500, {
                    "Content-Type": "text/plain"
                });

                return res.end("index.html tidak ditemukan.");
            }

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });

            res.end(data);
        });

        return;
    }

    // ===========================
    // CEK DEVICE
    // ===========================
    if (req.url === "/api/device") {

        runADB(["devices"], (error, stdout, stderr) => {

            if (error) {

                res.writeHead(500, {
                    "Content-Type": "application/json"
                });

                return res.end(JSON.stringify({
                    connected: false,
                    error: error.message
                }));
            }

            const lines = stdout
                .split(/\r?\n/)
                .map(x => x.trim())
                .filter(Boolean);

            const devices = [];

            for (const line of lines) {

                if (
                    line.startsWith("List of devices") ||
                    line.startsWith("*")
                ) {
                    continue;
                }

                const parts = line.split(/\s+/);

                if (parts.length >= 2) {

                    devices.push({
                        serial: parts[0],
                        state: parts[1]
                    });
                }
            }

            const connected = devices.some(
                d => d.state === "device"
            );

            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            return res.end(JSON.stringify({
                connected,
                devices
            }));
        });

        return;
    }

    // ===========================
    // SCREENSHOT HP
    // ===========================
    if (req.url === "/api/screenshot") {

        runADB(
            ["exec-out", "screencap", "-p"],
            (error, stdout, stderr) => {

                if (error) {

                    res.writeHead(500, {
                        "Content-Type": "application/json"
                    });

                    return res.end(JSON.stringify({
                        error: error.message
                    }));
                }

                // execFile stdout dapat berupa Buffer
                // tetapi default-nya string.
                // Karena screenshot PNG harus binary,
                // gunakan encoding null dengan cara lain.
            }
        );

        // Ulangi dengan spawn untuk binary PNG
        const { spawn } = require("child_process");

        const adb = spawn(
            ADB,
            ["exec-out", "screencap", "-p"],
            {
                windowsHide: true
            }
        );

        const chunks = [];

        adb.stdout.on("data", chunk => {
            chunks.push(chunk);
        });

        let errorText = "";

        adb.stderr.on("data", chunk => {
            errorText += chunk.toString();
        });

        adb.on("close", code => {

            if (code !== 0) {

                res.writeHead(500, {
                    "Content-Type": "application/json"
                });

                return res.end(JSON.stringify({
                    error: errorText || "ADB gagal mengambil screenshot."
                }));
            }

            const image = Buffer.concat(chunks);

            res.writeHead(200, {
                "Content-Type": "image/png",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            });

            res.end(image);
        });

        return;
    }

    // ===========================
    // UNKNOWN
    // ===========================
    res.writeHead(404, {
        "Content-Type": "text/plain"
    });

    res.end("404 - Not Found");
});

server.listen(PORT, () => {

    console.log("");
    console.log("======================================");
    console.log("   MUTASI DASHBOARD + ADB");
    console.log("======================================");
    console.log("");
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log("");
    console.log("Pastikan:");
    console.log("1. ADB sudah terinstall");
    console.log("2. HP tersambung USB");
    console.log("3. USB Debugging aktif");
    console.log("4. Izinkan koneksi USB Debugging di HP");
    console.log("");
});
