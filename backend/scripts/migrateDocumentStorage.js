const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Document = require("../models/Document");
const { storageService } = require("../services/storageService");

async function migrateDocuments() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/DevOps_Review";
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

  try {
    const documents = await Document.find({
      $or: [
        { fileKey: { $exists: false } },
        { fileKey: "" }
      ]
    }).select("_id fileUrl originalName mimeType");

    let migratedCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      const legacyPath = typeof doc.fileUrl === "string" ? path.resolve(doc.fileUrl) : "";
      if (!legacyPath) {
        skippedCount += 1;
        continue;
      }

      try {
        const fileBuffer = await fs.promises.readFile(legacyPath);
        const storedFile = await storageService.uploadFile(
          fileBuffer,
          doc.originalName || `document-${doc._id}`,
          doc.mimeType || "application/octet-stream",
          "documents"
        );

        doc.fileKey = storedFile.key;
        doc.fileUrl = storedFile.url;
        await doc.save();
        migratedCount += 1;
      } catch (error) {
        skippedCount += 1;
        console.warn(`[MIGRATE DOCUMENT STORAGE] Skipped ${String(doc._id)}: ${error.message}`);
      }
    }

    console.log(`[MIGRATE DOCUMENT STORAGE] Migrated ${migratedCount} documents, skipped ${skippedCount}.`);
  } finally {
    await mongoose.connection.close();
  }
}

migrateDocuments().catch((error) => {
  console.error("[MIGRATE DOCUMENT STORAGE] Failed", error?.message || error);
  process.exit(1);
});
