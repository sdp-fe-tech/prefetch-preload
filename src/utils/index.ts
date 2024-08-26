import { BinaryToTextEncoding, createHash } from 'crypto'

function createContentHash(
  content: string,
  hashFunction: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
  digestType: BinaryToTextEncoding = 'hex'
): string {
  const hash = createHash(hashFunction);
  hash.update(content);
  return hash.digest(digestType);
}


function replaceContentHashInFilename(
  filename: string,
  content: string,
  hashFunction: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
  digestType: BinaryToTextEncoding = 'hex'
): string {
  return filename.replace(/\[contenthash(?::(\d+))?\]/g, (_, length) => {
    const fullHash = createContentHash(content, hashFunction, digestType);
    return length ? fullHash.substring(0, parseInt(length)) : fullHash;
  });
}

export {
  replaceContentHashInFilename
}
