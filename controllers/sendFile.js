import { StringSession } from "telegram/sessions/index.js";
import { CONNECTION_RETRIES, apiCred } from "../config.js";
import { Api, TelegramClient } from "telegram";
import mime from 'mime';

export const FileHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No files were selected" });
    }
    const fileName = req.fileName;
    const originalFileName = req.fileOrgName;
    const user = req.body.user;
    const sessionString = user.session;
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiCred.apiId, apiCred.apiHash, {
      connectionRetries: CONNECTION_RETRIES,
    });
    await client.connect();
    const uploadDetails = await client.sendFile("me", {
      file: `files/${fileName}`,
      caption: "Uploaded Automatically",
    });
    user.files.push({
      id: uploadDetails.id,
      name: originalFileName,
    });
    console.log(uploadDetails);
    await user.save();
    await client.disconnect();

    res.json({
      id: uploadDetails.id,
      name: originalFileName,
      isFavourite: false,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to upload file" });
  }
};

export const fileDownloadHandler = async (req, res, next) => {
  const { fileId } = req.body;
  const user = req.body.user;
  const sessionString = user.session;
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiCred.apiId, apiCred.apiHash, {
    connectionRetries: CONNECTION_RETRIES,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error('Failed to connect to Telegram client:', error);
    return res.status(500).json({ error: 'Failed to connect to Telegram client' });
  }

  try {
    const result = await client.getMessages("me", {
      ids: Number(fileId)
    });

    if (result.length === 0 || !result[0].media) {
      return res.status(404).json({ error: 'File not found' });
    }

    const media = result[0].media;
    const buffer = await client.downloadMedia(media, {
      workers: 1,
    });

    let fileName = "download";
    if (media.document) {
      const attributes = media.document.attributes;
      fileName = attributes[0].fileName || attributes[1]?.fileName || "download";
    }
    if (fileName === "download") {
      res.json({ fileName: fileName, file: buffer.toString('base64'), mimeType: 'image/jpg' });
    } else {
      res.json({ fileName: fileName, file: buffer.toString('base64'), mimeType: mime.getType(fileName.split('.')[1]) });
    }
  } catch (error) {
    console.error('Failed to fetch or download media:', error);
    return res.status(500).json({ error: 'Failed to fetch or download media' });
  } finally {
    await client.disconnect();
  }
};