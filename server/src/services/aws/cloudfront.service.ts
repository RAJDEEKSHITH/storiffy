import {
  getSignedUrl,
} from "@aws-sdk/cloudfront-signer";
import { env } from "../../config/env.js";

const cloudFrontUrl = env.CLOUDFRONT_URL;

const keyPairId = env.KEY_PAIR_ID;

const privateKey = env.CLOUDFRONT_PRIVATE_KEY.replace(/\\n/g,"\n");

const DOWNLOAD_URL_TTL = 5 * 60 * 1000;
const VIEW_URL_TTL = 10 * 60 * 1000;

export const generateCloudFrontSignedUrl =({
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
    const url =
      `${cloudFrontUrl}/${key}` +
      `?response-content-disposition=${encodeURIComponent(
        `${disposition}; filename="${fileName}"`,
      )}`;

    return getSignedUrl({
      url,
      keyPairId,
      dateLessThan: new Date(Date.now() + ttl).toISOString(),
      privateKey,
    });
  };