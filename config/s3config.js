const { S3Client } = require("@aws-sdk/client-s3");
require('dotenv').config(); // Ensure environment variables are loaded

const s3Client = new S3Client({
    endpoint: "https://n2-frs-par-clevercloud-customers.services.clever-cloud.com", // Make sure this matches your bucket's endpoint
    credentials: {
    accessKeyId: process.env.CC_FS_BUCKET_USER,
    secretAccessKey: process.env.CC_FS_BUCKET_PASSWORD,
  },
  region: process.env.CC_FS_BUCKET_REGION, // Use the environment variable for region
});

console.log("process.env.CC_FS_BUCKET_URL", process.env.CC_FS_BUCKET_URL);
console.log("process.env.CC_FS_BUCKET_USER", process.env.CC_FS_BUCKET_USER);
console.log("process.env.CC_FS_BUCKET_REGION", process.env.CC_FS_BUCKET_REGION);

module.exports = s3Client;
