/**
 * Minimal store-only (no compression) ZIP writer.
 *
 * Shapefiles arrive as a set of sibling files (.shp/.dbf/.shx/.prj/...), but
 * the backend ingests a single .zip. Rather than pull in a dependency, we
 * bundle the staged parts into a store-mode archive in the browser. Store mode
 * needs only a CRC-32 and the raw bytes, so the whole writer fits here.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a store-only ZIP Blob from the given files. */
export async function zipStore(files: File[]): Promise<Blob> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const data = new Uint8Array(await file.arrayBuffer());
    const nameBytes = enc.encode(file.name);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);     // local file header signature
    local.setUint16(4, 20, true);              // version needed
    local.setUint16(6, 0, true);               // flags
    local.setUint16(8, 0, true);               // method 0 = store
    local.setUint16(10, 0, true);              // mod time
    local.setUint16(12, 0, true);              // mod date
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);    // compressed size
    local.setUint32(22, data.length, true);    // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);              // extra length
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);         // central directory signature
    cd.setUint16(4, 20, true);                 // version made by
    cd.setUint16(6, 20, true);                 // version needed
    cd.setUint16(8, 0, true);
    cd.setUint16(10, 0, true);                 // method
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true);                 // extra length
    cd.setUint16(32, 0, true);                 // comment length
    cd.setUint16(34, 0, true);                 // disk number
    cd.setUint16(36, 0, true);                 // internal attrs
    cd.setUint32(38, 0, true);                 // external attrs
    cd.setUint32(42, offset, true);            // local header offset
    const cdBytes = new Uint8Array(46 + nameBytes.length);
    cdBytes.set(new Uint8Array(cd.buffer), 0);
    cdBytes.set(nameBytes, 46);
    central.push(cdBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    chunks.push(c);
    cdSize += c.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);          // end of central directory
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, cdStart, true);
  end.setUint16(20, 0, true);                  // comment length
  chunks.push(new Uint8Array(end.buffer));

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/zip' });
}
