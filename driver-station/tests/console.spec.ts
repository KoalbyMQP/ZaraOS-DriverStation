import {test, expect} from "@playwright/test";
import fetch from 'node-fetch';

test.describe.serial("Console tests", () => {
    test('pair Cortex and input code', async ({ page }) => {
        const startRes = await fetch('http://localhost:8080/auth/pair/start', {
            method: 'POST',
        });
        const data = await startRes.json();
        console.log('Expires in:', data.expires_in);
        const code = await getCodeFromCortexLog(); 
        await page.goto('http://localhost:3000/');
        await page.getByRole('textbox', { name: 'Pairing code' }).fill(code);
        await page.getByRole('button', { name: 'Submit' }).click();
        await expect(page.getByText('Pairing successful')).toBeVisible();
    });
    
})