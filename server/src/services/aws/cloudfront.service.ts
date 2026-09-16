import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const cloudFrontUrl = process.env.CLOUDFRONT_URL!;
const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID!;
const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY!;

/**
 * Generate a CloudFront signed URL for viewing or downloading
 * a private file.
 *
 * download = false -> inline/view
 * download = true  -> attachment/download
 */
export const createCloudFrontGetSignedUrl = ({
  key,
  download = false,
  fileName,
}: {
  key: string;
  download?: boolean;
  fileName: string;
}) => {
  const disposition = download ? "attachment" : "inline";

  const url =
    `${cloudFrontUrl}/${key}` +
    `?response-content-disposition=${encodeURIComponent(
      `${disposition}; filename="${fileName}"`,
    )}`;

  return getSignedUrl({
    url,
    keyPairId,
    dateLessThan: new Date(
      Date.now() + 5 * 60 * 1000,
    ).toISOString(),
    privateKey,
  });
};