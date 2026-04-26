import express from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const storage = new Storage();

// 🔥 tvoj bucket v GCP
const bucket = storage.bucket("static-assets-demo");

// --- METADATA VALIDÁCIA ---
function validateMetadata(meta) {
    if (!meta) return "Missing metadata";

    if (!meta.owner) return "Missing owner";
    if (!meta.type) return "Missing type";

    const allowedTypes = ["image", "banner", "avatar"];

    if (!allowedTypes.includes(meta.type)) {
        return "Invalid type (allowed: image, banner, avatar)";
    }

    return null;
}

// --- HEALTH CHECK (Cloud Run needs this) ---
app.get("/", (req, res) => {
    res.send("IMG API running use it to test");
});

// --- UPLOAD ENDPOINT ---
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }

        let metadata = {};
        try {
            metadata = JSON.parse(req.body.metadata || "{}");
        } catch (e) {
            return res.status(400).send("Invalid metadata JSON");
        }

        // VALIDATION
        const error = validateMetadata(metadata);
        if (error) {
            return res.status(400).send(error);
        }

        // filename
        const filename = Date.now() + "-" + req.file.originalname;

        const file = bucket.file(filename);

        const stream = file.createWriteStream({
            metadata: {
                metadata: {
                    owner: metadata.owner,
                    type: metadata.type
                }
            }
        });

        stream.on("error", (err) => {
            console.error(err);
            res.status(500).send("Upload failed");
        });

        stream.on("finish", () => {
            res.json({
                message: "Upload successful",
                file: filename,
                bucket: "static-assets-demo",
                metadata: metadata
            });
        });

        stream.end(req.file.buffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// --- CLOUD RUN PORT1 ---
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port", PORT);
});