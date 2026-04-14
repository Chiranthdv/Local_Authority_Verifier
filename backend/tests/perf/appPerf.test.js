const autocannon = require("autocannon");
const { app } = require("../../app");

function run(url) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url,
        connections: 10,
        duration: 2,
        pipelining: 1
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

describe("Basic backend performance", () => {
  test("root endpoint responds with acceptable average latency", async () => {
    const server = app.listen(0);
    const port = server.address().port;
    const result = await run(`http://127.0.0.1:${port}/`);
    server.close();

    expect(result.errors).toBe(0);
    expect(result.non2xx).toBe(0);
    expect(result.requests.average).toBeGreaterThan(100);
    expect(result.latency.average).toBeLessThan(1000);
  }, 20000);
});
