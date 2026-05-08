import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin@12345";

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}@example.com`;
}

async function registerUser(page, { name, email, password, role }) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Role").selectOption(role);
  await page.getByRole("button", { name: "Register" }).click();
}

async function loginUser(page, { email, password }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("worker onboarding to booking, chat, completion, review, and notifications", async ({ browser }) => {
  const workerEmail = uniqueEmail("worker");
  const customerEmail = uniqueEmail("customer");
  const password = "Password123";
  const workerName = "Workflow Worker";
  const customerName = "Workflow Customer";

  const workerPage = await browser.newPage();
  const adminPage = await browser.newPage();
  const customerPage = await browser.newPage();

  await test.step("worker registers and uploads a certificate", async () => {
    await registerUser(workerPage, {
      name: workerName,
      email: workerEmail,
      password,
      role: "worker"
    });

    await expect(workerPage).toHaveURL(/\/worker\/onboarding/);
    await workerPage.getByPlaceholder("Age (18-80)").fill("29");
    await workerPage.getByPlaceholder("Location (e.g., Bangalore)").fill("Bangalore");
    await workerPage.getByPlaceholder("Phone number").fill("9999999999");
    await workerPage.getByRole("button", { name: "Next" }).click();

    await workerPage.getByRole("combobox").first().selectOption("electrician");
    await workerPage.getByPlaceholder("Years of experience").fill("6");
    await workerPage.getByPlaceholder("Hourly rate (Rs)").fill("500");
    await workerPage.getByPlaceholder("Skills (comma separated)").fill("wiring, repair");
    await workerPage.getByPlaceholder("Bio").fill("Reliable electrician for home repairs.");
    await workerPage.getByRole("button", { name: "Next" }).click();

    await workerPage.locator('input[type="file"]').setInputFiles({
      name: "certificate.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("sample certificate")
    });
    await workerPage.getByRole("button", { name: /Upload 1 Certificate/i }).click();
    await expect(workerPage.getByText(/Certificates uploaded successfully/i)).toBeVisible();
  });

  await test.step("admin approves the worker application and document", async () => {
    await loginUser(adminPage, {
      email: adminEmail,
      password: adminPassword
    });

    await expect(adminPage).toHaveURL(/\/admin\/dashboard/);
    await adminPage.getByRole("button", { name: "View Application" }).first().click();
    await adminPage.getByRole("button", { name: "Approve" }).first().click();
    await adminPage.getByRole("button", { name: "Approve Worker" }).click();
  });

  await test.step("customer books the approved worker", async () => {
    await registerUser(customerPage, {
      name: customerName,
      email: customerEmail,
      password,
      role: "customer"
    });

    await customerPage.goto("/search");
    await customerPage.getByPlaceholder(/Search by service/i).fill("electrician");
    await customerPage.getByRole("button", { name: "Search" }).click();
    await customerPage.getByRole("button", { name: new RegExp(workerName, "i") }).first().click();

    await expect(customerPage.getByRole("button", { name: "Request Service" })).toBeVisible();
    await customerPage.getByRole("button", { name: "Request Service" }).click();
    await customerPage.locator('input[type="date"]').fill("2026-12-15");
    await customerPage.getByLabel("Address").fill("123 Demo Street");
    await customerPage.getByLabel("Description").fill("Need help with bedroom wiring.");
    await customerPage.getByRole("button", { name: "Send Request" }).click();
    await expect(customerPage.getByText(/Service request sent to worker/i)).toBeVisible();
  });

  await test.step("worker accepts the job and opens chat", async () => {
    await workerPage.goto("/requests/inbox");
    await workerPage.getByRole("button", { name: "Accept" }).first().click();
    await workerPage.getByRole("button", { name: "Open Chat" }).first().click();
    await expect(workerPage).toHaveURL(/\/chats/);
    await workerPage.getByPlaceholder(/Type your message/i).fill("Hello, I can take this job.");
    await workerPage.getByRole("button", { name: /Send/i }).click();
  });

  await test.step("customer sees notification, chats back, and later reviews the worker", async () => {
    await customerPage.goto("/notifications");
    await expect(customerPage.getByRole("heading", { name: "Notifications" })).toBeVisible();

    await customerPage.goto("/chats");
    await customerPage.getByPlaceholder(/Type your message/i).fill("Great, please come by 10 AM.");
    await customerPage.getByRole("button", { name: /Send/i }).click();

    await workerPage.goto("/requests/inbox");
    await workerPage.getByRole("button", { name: "Mark Completed" }).first().click();

    await customerPage.goto("/requests/my");
    await customerPage.getByRole("button", { name: "Leave Review" }).first().click();
    await customerPage.getByRole("button", { name: "5" }).click();
    await customerPage.getByPlaceholder(/Optional feedback/i).fill("Arrived on time and fixed the issue.");
    await customerPage.getByRole("button", { name: "Submit Review" }).click();
    await expect(customerPage.getByText(/Review submitted/i)).toBeVisible();
  });
});
