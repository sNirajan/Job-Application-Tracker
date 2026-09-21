const documentService = require("../services/documents.service");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const documents = await documentService.listDocuments(req.userId, req.params.id);
  res.json({ data: documents });
});

const upload = asyncHandler(async (req, res) => {
  const document = await documentService.uploadDocument(
    req.userId,
    req.params.id,
    req.file,
    req.validated,
  );
  res.status(201).json({ data: document });
});

// Streams the file (local storage) or redirects to a signed S3 link.
const download = asyncHandler(async (req, res) => {
  await documentService.sendDocument(
    req.userId,
    req.params.id,
    req.params.documentId,
    res,
  );
});

const remove = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.userId, req.params.id, req.params.documentId);
  res.status(204).send();
});

module.exports = { list, upload, download, remove };
