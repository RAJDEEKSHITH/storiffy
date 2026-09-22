import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { env } from "../../config/env.js";

const cloudFrontUrl = env.CLOUDFRONT_URL;
const keyPairId = env.KEY_PAIR_ID;
const privateKey = env.CLOUDFRONT_PRIVATE_KEY.replace(/\\n/g, "\n");

const DOWNLOAD_URL_TTL = 5 * 60 * 1000;
const VIEW_URL_TTL = 10 * 60 * 1000;

const createAsciiFilename = (fileName: string) => {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const sanitized = normalized
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/["\\]/g, "-")
    .replace(/[<>:/|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "download";
};

const encodeRFC5987Value = (value: string) =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export const generateCloudFrontSignedUrl = ({
  key,
  download,
  fileName,
}: {
  key: string;
  download: boolean;
  fileName: string;
}) => {
  const disposition = download ? "attachment" : "inline";
  const ttl = download ? DOWNLOAD_URL_TTL : VIEW_URL_TTL;

  const asciiFilename = createAsciiFilename(fileName);
  const encodedFilename = encodeRFC5987Value(fileName);

  const contentDisposition =
    `${disposition}; ` +
    `filename="${asciiFilename}"; ` +
    `filename*=UTF-8''${encodedFilename}`;

  const url =
    `${cloudFrontUrl}/${key}` +
    `?response-content-disposition=${encodeURIComponent(
      contentDisposition,
    )}`;

  return getSignedUrl({
    url,
    keyPairId,
    dateLessThan: new Date(Date.now() + ttl).toISOString(),
    privateKey,
  });
};