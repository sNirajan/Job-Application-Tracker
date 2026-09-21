const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config");
const { contentDisposition } = require("./contentDisposition");

// No keys in code or env: on ECS the SDK picks up the task role automatically.
const client = new S3Client({ region: config.storage.s3Region });
const Bucket = config.storage.s3Bucket;

// Signed download links expire quickly so a leaked link stops working.
const DOWNLOAD_URL_TTL_SECONDS = 60;

async function save(key, buffer, mimeType) {
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    }),
  );
}

async function remove(key) {
  // S3 delete succeeds even if the object is already gone
  await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

async function sendFile(res, doc) {
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket,
      Key: doc.storage_key,
      ResponseContentType: doc.mime_type,
      ResponseContentDisposition: contentDisposition(doc.original_name),
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
  res.redirect(302, url);
}

module.exports = { save, remove, sendFile };
