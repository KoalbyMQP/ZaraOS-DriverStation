// @ts-check
import { test, expect } from "@playwright/test";

test.describe.serial("Auth tests", () => {
  test("testing signup", async ({ page }) => {
    await page.goto('http://localhost:3000/authenticate');
    const uniqueEmail = `user${Date.now()}@wpi.edu`;
    await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('123456');
    await page.getByRole('textbox', { name: 'First name' }).fill('j');
    await page.getByRole('textbox', { name: 'Last name' }).fill('t');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    await page.getByRole('button', { name: 'Back to login' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('123456');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL("http://localhost:3000/"); 
  });

  test("testing login", async ({ page }) => {
    await page.goto('http://localhost:3000/authenticate');
    await page.getByText('Welcome, userContinue').click();
    await page.getByRole('textbox', { name: 'Email' }).fill('jrtinti@wpi.edu');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('123456');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL("http://localhost:3000/"); 
  });
});

test("test signin when there is already an email associated", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/authenticate");
  await page.getByRole("textbox", { name: "Email" }).fill("jrtinti@wpi.edu");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("button", { name: "Forgot password?" })
  ).toBeVisible();
});

test("test log out", async ({ page }) => {
  // login
  await page.goto('http://localhost:3000/authenticate');
  await page.getByText('Welcome, userContinue').click();
  await page.getByRole('textbox', { name: 'Email' }).fill('jrtinti@wpi.edu');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('123456');
  await page.getByRole('button', { name: 'Login' }).click();
  // end login
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL("http://localhost:3000/authenticate");
});

test("testing invalid password on login", async ({ page }) => {
  await page.goto("http://localhost:3000/authenticate");
  await page.getByRole('textbox', { name: 'Email' }).fill('jrtinti@wpi.edu');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('123457');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(
    page.getByRole('button', {name: 'OK'})
  ).toBeVisible();
});

test("testing entering an email into login that does not exist in db", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/authenticate");
  await page.getByRole('textbox', { name: 'Email' }).fill('jrtint@wpi.edu');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('textbox', {name: 'First name'})).toBeVisible(); 
});

// next tests for this
// entering not an email for signup
// this will not work until we have verify email done

// test('testing entering an email into signup where their email is not an actual email', async({page}) => {
//   await page.goto('http://localhost:3000/');
//   await page.getByRole('button', { name: 'Sign up' }).click();
//   await page.getByRole('textbox', { name: 'Email' }).fill('steve');
//   await page.getByRole('button', { name: 'Continue' }).click();
//   await page.getByRole('textbox', { name: 'Password' }).fill('123456');
//   await page.getByRole('textbox', { name: 'First name' }).fill('s');
//   await page.getByRole('textbox', { name: 'Last name' }).fill('v');
//   await page.getByRole('button', { name: 'Sign up' }).click();

// });
