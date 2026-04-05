import { expect, test } from '@playwright/test'

test('login gate renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Data4Life').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
