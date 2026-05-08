const request = require("supertest");
const { app } = require("../../app");
const setupMongo = require("../helpers/setupMongo");
const User = require("../../models/User");
const WorkerProfile = require("../../models/WorkerProfile");
const Job = require("../../models/Job");

jest.setTimeout(20000);

async function createUser({ name, email, password, role }) {
  const user = new User({ name, email, password, role });
  await user.save();
  return user;
}

describe("Booking flow integration", () => {
  beforeAll(async () => {
    await setupMongo.connect();
  });

  afterEach(async () => {
    await setupMongo.clearDatabase();
  });

  afterAll(async () => {
    await setupMongo.closeDatabase();
  });

  test("customer can create and worker can accept a booking request", async () => {
    const worker = await createUser({
      name: "Worker One",
      email: "worker1@example.com",
      password: "Password123",
      role: "worker"
    });

    const customer = await createUser({
      name: "Customer One",
      email: "customer1@example.com",
      password: "Password123",
      role: "customer"
    });

    await new WorkerProfile({
      userId: worker._id,
      category: "plumber",
      experience: 3,
      location: "Testville",
      verificationStatus: "approved"
    }).save();

    const customerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@example.com", password: "Password123" });

    expect(customerLogin.status).toBe(200);
    const customerCookie = customerLogin.headers["set-cookie"]?.[0];
    expect(customerCookie).toBeTruthy();

    const bookingDate = new Date();
    bookingDate.setUTCDate(bookingDate.getUTCDate() + 2);

    const bookingResponse = await request(app)
      .post("/api/jobs/create")
      .set("Cookie", customerCookie)
      .send({
        workerId: worker._id.toString(),
        serviceDate: bookingDate.toISOString(),
        timeSlotCode: "SLOT_06_10",
        description: "Fix kitchen leak",
        address: "123 Main St"
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.status).toBe("pending");
    expect(bookingResponse.body.workerId).toBe(String(worker._id));

    const workerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "worker1@example.com", password: "Password123" });

    expect(workerLogin.status).toBe(200);
    const workerCookie = workerLogin.headers["set-cookie"]?.[0];
    expect(workerCookie).toBeTruthy();

    const acceptResponse = await request(app)
      .patch(`/api/jobs/${bookingResponse.body._id}/accept`)
      .set("Cookie", workerCookie)
      .send();

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.status).toBe("accepted");

    const updatedJob = await Job.findById(bookingResponse.body._id);
    expect(updatedJob).not.toBeNull();
    expect(updatedJob.status).toBe("accepted");
  });
});
