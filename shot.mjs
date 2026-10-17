import { chromium } from '/private/tmp/claude-501/-Users-jaco-Development-cricket-platform-v2/c7cb858d-7865-424f-a91e-8980c6831dc4/scratchpad/wt114/ui/node_modules/playwright/index.mjs'
const b = await chromium.launch()
for (const [w,h] of [[1280,800],[375,700]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto('http://localhost:5199/tmpshot.html'); await p.waitForTimeout(1500)
  await p.screenshot({ path: `/private/tmp/claude-501/-Users-jaco-Development-cricket-platform-v2/c7cb858d-7865-424f-a91e-8980c6831dc4/scratchpad/shot${w}.png` })
}
await b.close()
