import {
  transload,
  createJobPlan,
  sourceToGtrProxySource
} from "../src/transload";

const proxyBaseUrl = "https://gtr-proxy.677472.xyz";

const someFileUrl = "https://gtr-test.677472.xyz/200MB.zip";
// File exists on-demand. Does not always exist for obvious reasons.
// This is hosted on R2, so it is unlimited bandwidth, but not storage.
const superlargeFileUrl = "https://gtr-test.677472.xyz/50GB.dat";

describe("transload", () => {
  test("is able to produce a job plan from a source", async () => {
    const mb = 100;
    const jobPlan = await createJobPlan(someFileUrl, mb);
    console.log(`Got job plan: `, jobPlan);
    expect(jobPlan.chunks.length).toBeGreaterThan(0);
    expect(jobPlan.chunks[0].start).toBe(0);

    expect(jobPlan.chunks[0].size).toBe(mb * 1024 * 1024);
    // expect(jobPlan.chunks[1].size).toBe(88843308);
    // Check last chunk in jobPlan
    expect(jobPlan.chunks[jobPlan.chunks.length - 1].start).toBeGreaterThan(0);
    expect(jobPlan.chunks[jobPlan.chunks.length - 1].size).toBeGreaterThan(0);
    expect(
      jobPlan.chunks[jobPlan.chunks.length - 1].start +
        jobPlan.chunks[jobPlan.chunks.length - 1].size
    ).toBe(jobPlan.length);
    // Make sure none of the job plans have a size of 0
    jobPlan.chunks.forEach((chunk) => {
      expect(chunk.size).toBeGreaterThan(0);
    });
    //
    expect(jobPlan.length).toBe(209715200);
  });

  test("can tell azure to transload a file", async () => {
    const AZURE_STORAGE_CONNECTION_STRING =
      process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error("No AZURE_STORAGE_CONNECTION_STRING");
    }

    await transload(
      someFileUrl,
      AZURE_STORAGE_CONNECTION_STRING,
      "gtr-ext-test-medium-file.dat",
      proxyBaseUrl,
      50
    );
  }, 30000);

  test("can tell azure to transload a file that is from the proxy", async () => {
    const AZURE_STORAGE_CONNECTION_STRING =
      process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error("No AZURE_STORAGE_CONNECTION_STRING");
    }

    const proxifiedSomeFileUrl = sourceToGtrProxySource(someFileUrl);

    await transload(
      proxifiedSomeFileUrl,
      AZURE_STORAGE_CONNECTION_STRING,
      "gtr-ext-test-medium-file-proxy.dat"
    );
  }, 30000);

  // This test is disabled because hosting the 50GB test file is too expensive.
  test.skip("can transload a superlarge test file from the test site directly to azure", async () => {
    const AZURE_STORAGE_CONNECTION_STRING =
      process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error("No AZURE_STORAGE_CONNECTION_STRING");
    }

    const targetUrl = sourceToGtrProxySource(superlargeFileUrl);

    await transload(
      targetUrl,
      AZURE_STORAGE_CONNECTION_STRING,
      "gtr-ext-test-superlarge-file.dat",
      proxyBaseUrl,
      1000
    );
  }, 60000);
});

describe("sourceToGtrProxySource", () => {
  test("should return a proxied URL", () => {
    const sourceUrl = "https://example.com/file.zip";
    const expectedUrl = `${proxyBaseUrl}/p/example.com/file.zip`;
    expect(sourceToGtrProxySource(sourceUrl, proxyBaseUrl)).toBe(expectedUrl);
  });

  test("should handle encoded slashes in source URL", () => {
    const sourceUrl = "https://example.com/some%2Fpath/file.zip";
    const expectedUrl = `${proxyBaseUrl}/p/example.com/some%252Fpath/file.zip`;
    expect(sourceToGtrProxySource(sourceUrl, proxyBaseUrl)).toBe(expectedUrl);
  });

  test("should include encodedCookies if provided", () => {
    const sourceUrl = "https://example.com/file.zip";
    const cookies = "testcookies";
    const expectedUrl = `${proxyBaseUrl}/p/example.com/file.zip?a=${cookies}`;
    expect(sourceToGtrProxySource(sourceUrl, proxyBaseUrl, cookies)).toBe(
      expectedUrl
    );
  });

  test("should use & for cookies if query params already exist", () => {
    const sourceUrl = "https://example.com/file.zip?param=value";
    const cookies = "testcookies";
    const expectedUrl = `${proxyBaseUrl}/p/example.com/file.zip?param=value&a=${cookies}`;
    expect(sourceToGtrProxySource(sourceUrl, proxyBaseUrl, cookies)).toBe(
      expectedUrl
    );
  });

  test("should throw an error if the generated URL is too long", () => {
    const sourceUrl = "https://example.com/file.zip";
    const longCookies = "a".repeat(2048);
    expect(() => {
      sourceToGtrProxySource(sourceUrl, proxyBaseUrl, longCookies);
    }).toThrow(/Proxy URL length \(\d+\) exceeds the maximum of 2048 bytes./);
  });
});
