// Just Enough ContainerClient
// A reimplementation of the Azure Storage ContainerClient that only supports
// the methods we need.

import "isomorphic-fetch";
import fetchBuilder from "fetch-retry";

var fetch = fetchBuilder(globalThis.fetch);

export class ContainerClient {
  constructor(public readonly containerUrl: string) {
    containerUrl = containerUrl;
  }

  getBlockBlobClient(blobName: string): BlockBlobClient {
    return new BlockBlobClient(this, blobName);
  }
}

export class BlockBlobClient {
  constructor(
    public readonly containerClient: ContainerClient,
    public readonly blobName: string
  ) {
    containerClient = containerClient;
    blobName = blobName;
  }

  async stageBlockFromURL(
    blockId: string,
    sourceUrl: string,
    offset: number,
    count: number
  ): Promise<Response> {
    console.log(`Staging block ${blockId} from ${sourceUrl}`);
    const containerUrl = new URL(this.containerClient.containerUrl);
    const blobUrl = new URL(
      containerUrl.protocol +
        "//" +
        containerUrl.host +
        containerUrl.pathname +
        `/${this.blobName}` +
        containerUrl.search +
        `&blockid=${blockId}` +
        `&comp=block`
    );
    const resp = await fetch(blobUrl.toString(), {
      method: "PUT",
      retries: 3,
      retryDelay: 1000,
      retryOn: [409],
      headers: {
        "x-ms-version": "2020-10-02",
        "x-ms-source-range": `bytes=${offset}-${offset + count - 1}`,
        "x-ms-copy-source": sourceUrl
      }
    });
    if (resp.ok) {
      return resp;
    }
    throw new Error(
      `Failed to stage block: ${resp.status} ${await resp.text()}`
    );
  }

  async commitBlockList(blocks: string[]): Promise<Response> {
    console.log(`Committing block list: ${blocks}`);
    const containerUrl = new URL(this.containerClient.containerUrl);
    const blobUrl = new URL(
      containerUrl.protocol +
        "//" +
        containerUrl.host +
        containerUrl.pathname +
        `/${this.blobName}` +
        containerUrl.search +
        `&comp=blocklist`
    );
    const data = `<?xml version="1.0" encoding="utf-8"?>
<BlockList>
${blocks.map((blockId) => `<Latest>${blockId}</Latest>`).join("\n")}
</BlockList>`;

    const resp = await fetch(blobUrl.toString(), {
      method: "PUT",
      body: data,
      headers: {
        "x-ms-version": "2020-10-02"
      }
    });

    if (resp.ok) {
      return resp;
    }
    throw new Error(`Failed to commit block list: ${resp.status}`);
  }
}
