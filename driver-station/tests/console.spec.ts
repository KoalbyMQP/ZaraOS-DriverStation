import {test, expect} from "@playwright/test";


async function login(page) {
  await page.goto('http://localhost:3000/authenticate');
  await page.getByRole('textbox', { name: 'Email' }).fill('jrtinti@wpi.edu');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('123456');
  await page.getByRole('button', { name: 'Login' }).click();
}

async function connectRobot(page, code: string) {
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.getByRole('textbox', { name: 'e.g.' }).fill('localhost');
  await page.getByLabel('Connect to robot').getByRole('button', { name: 'Connect' }).click();
  await page.getByRole('textbox', { name: '000000' }).fill(code);
  await page.getByRole('button', { name: 'Pair' }).click();
}

test.describe.serial("Console tests", () => {
    test('pair Cortex and input code', async ({ page }) => {
        const startRes = await fetch('http://localhost:8080/auth/pair/start', {
            method: 'POST',
        });
        const data = await startRes.json();
        console.log('Expires in:', data.expires_in);
        const code = await getCodeFromCortexLog(); 
        await login(page); 
        await connectRobot(page, code); 
        await expect(page.getByText('Robotlocalhost')).toBeVisible();
    });

    test('Disconnect from the robot', async({page}) => {
        const startRes = await fetch('http://localhost:8080/auth/pair/start', {
            method: 'POST',
        });
        const data = await startRes.json();
        console.log('Expires in:', data.expires_in);
        const code = await getCodeFromCortexLog(); 
        await login(page); 
        await connectRobot(page, code); 
        await page.getByRole('button', { name: 'Connected: Robot' }).click();
        await page.getByRole('button', { name: 'Disconnect' }).click(); 
        await expect(page.getByText('Not connected')).toBeVisible();
    });

    test('Check going to app routes', async({page}) => {
        await login(page); 
        await page.getByRole('link', { name: 'Add from Apps' }).click();
        await expect(page).toHaveURL("http://localhost:3000/apps");
    }); 

    // waiting to see how to correctly implement apps 
    /** 
    test('Check adding an app', async({page}) => {
        const startRes = await fetch('http://localhost:8080/auth/pair/start', {
            method: 'POST',
        });
        const data = await startRes.json();
        console.log('Expires in:', data.expires_in);
        const code = await getCodeFromCortexLog(); 
        await login(page); 
        await connectRobot(page, code); 
        await page.getByRole('link', { name: 'Add from Apps' }).click();
        await page.getByRole('button', { name: 'Select version' }).click();
        await page.getByRole('button', { name: 'v0.0.1' }).click();
    });

    test('Check trying to add an app when the robot is not connected', async({page}) => {
        await login(page); 
        await page.getByRole('link', { name: 'Add from Apps' }).click();
        await page.getByRole('button', { name: 'Select version' }).click();
        await page.getByRole('button', { name: 'v0.0.1' }).click();
        await expect(page.getByText('Connect to a device to add')).toBeVisible();
    });
    
    */
    test('Incorrect ip given for connection', async({page}) => {
        await login(page);  
        await page.getByRole('button', { name: 'Connect' }).click();
        await page.getByRole('textbox', { name: 'e.g.' }).fill('l');
        await page.getByLabel('Connect to robot').getByRole('button', { name: 'Connect' }).click();
        await expect(page.getByText('Could not reach the robot.')).toBeVisible();
    });

    test('Incorrect code given for connecting', async({page}) => {
        await login(page); 
        await page.getByRole('button', { name: 'Connect' }).click();
        await page.getByRole('textbox', { name: 'e.g.' }).fill('localhost');
        await page.getByLabel('Connect to robot').getByRole('button', { name: 'Connect' }).click();
        await page.getByRole('textbox', { name: '000000' }).fill('111111');
        await page.getByRole('button', { name: 'Pair' }).click();
        await expect(page.getByText('invalid or expired code')).toBeVisible();
    }); 

})