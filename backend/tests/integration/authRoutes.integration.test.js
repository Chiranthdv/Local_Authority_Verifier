const request = require("supertest");
const { app } = require("../../app");
const setupMongo = require("../helpers/setupMongo");
const User = require("../../models/User");

jest.setTimeout(20000);

describe("Auth integration", () => {
  beforeAll(async () => {
    await setupMongo.connect();
  });

  afterEach(async () => {
    await setupMongo.clearDatabase();
  });

  afterAll(async () => {
    await setupMongo.closeDatabase();
  });

  test("registers a new customer and returns expected payload", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "Password123",
        role: "customer"
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: "Test User",
      email: "test@example.com",
      role: "customer"
    });

    const user = await User.findOne({ email: "test@example.com" }).select("name email role");
    expect(user).not.toBeNull();
    expect(user.name).toBe("Test User");
  });

  test("rejects registration with invalid email format", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Bad Email",
        email: "bad-email",
        password: "Password123",
        role: "customer"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid email format");
  });

  test("logs in a registered user and sets session cookies", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User",
      email: "login@example.com",
      password: "Password123",
      role: "worker"
    });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "Password123" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.role).toBe("worker");
    expect(Array.isArray(loginResponse.headers["set-cookie"])).toBe(true);
    const cookieHeader = loginResponse.headers["set-cookie"].join(";");
    expect(cookieHeader).toContain("accessToken=");
    expect(cookieHeader).toContain("refreshToken=");
  });
});
