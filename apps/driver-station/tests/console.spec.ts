import {test, expect} from "@playwright/test";

test.describe.serial("Console tests", () => {
    test('Connect to robot in dev mode', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('button', { name: 'Dev Mode' }).click();
        await expect(page.getByText('Dev Mode127.0.0.1')).toBeVisible();
    });

    test('Disconnect from the robot', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('button', { name: 'Dev Mode' }).click();
        await page.getByRole('button', { name: 'Connected in Dev Mode' }).click();
        await page.getByRole('button', { name: /disconnect/i }).click();
        await expect(page.getByText('Not connected')).toBeVisible();
    });

    test('Check going to app routes', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('link', { name: 'Add from Apps' }).click();
        await expect(page).toHaveURL("http://localhost:3000/apps");
    }); 

    test('Check going to console route', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('link', { name: 'Console' }).click();
        await expect(page.getByText('No robot connected. Use the')).toBeVisible();
    }); 

    test('Check going to console with robot connected', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('button', { name: 'Dev Mode' }).click();
        await page.getByRole('link', { name: 'Console' }).click();
        await expect(page.getByText('#################################')).toBeVisible();
    }); 


    // waiting to see how to correctly implement apps 
    /** 
    test('Check adding an app', async({page}) => {
        await page.getByRole('link', { name: 'Add from Apps' }).click();
        await page.getByText('No local container images').click();
        await page.getByRole('button', { name: 'Select version' }).click();
        await page.getByRole('button', { name: 'v0.0.1' }).click();
    });

    test('Check trying to add an app when the robot is not connected', async({page}) => {
        await page.getByRole('link', { name: 'Add from Apps' }).click();
        await page.getByRole('button', { name: 'Select version' }).click();
        await page.getByRole('button', { name: 'v0.0.1' }).click();
        await expect(page.getByText('Connect to a device to add')).toBeVisible();   // this wording might be wrong 
    });
    
    */
    test('Incorrect ip given for connection', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('button', { name: 'Connect' }).click();
        await page.getByRole('textbox', { name: 'e.g.' }).fill('l');
        await page.getByLabel('Connect to robot').getByRole('button', { name: 'Connect' }).click();
        await expect(page.getByText('Could not reach the robot.')).toBeVisible();
    });

    test('Incorrect code given for connecting', async({page}) => {
        await page.goto('http://localhost:3000/');
        await page.getByRole('button', { name: 'Connect' }).click();
        await page.getByRole('textbox', { name: 'e.g.' }).fill('localhost');
        await page.getByLabel('Connect to robot').getByRole('button', { name: 'Connect' }).click();
        await page.getByRole('textbox', { name: '000000' }).fill('111111');
        await page.getByRole('button', { name: 'Pair' }).click();
        await expect(page.getByText('invalid or expired code')).toBeVisible();
    }); 

})